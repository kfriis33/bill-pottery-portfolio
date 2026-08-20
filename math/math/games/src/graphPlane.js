// Ported from src/Graphwar/GraphPlane.java, with the slice of GameData.java
// that drives its animation timing (isDrawingFunction/getCurrentFunctionPosition/
// isExploding/getTimeExploding/nextTurn) folded in, since a standalone
// GraphPlane has nothing to render otherwise. Sprite-sheet rendering
// (soldier idle/death animations, explosion frames, name-tag bubbles) is
// replaced with plain shapes — this prototype has no art assets.
//
// Runs in one of two modes:
//  - Local sandbox (newMatch/fire): a fixed two-soldier match with no
//    networking, used by the original GraphPlane-in-Canvas checkpoint. Turn
//    order and game-over are decided locally.
//  - Networked (loadNetworkedMatch/playShot/advanceTurn/setGameOver): state
//    (whose turn, who's alive, who won) is only ever changed by explicit
//    calls driven by RoomClient messages — this class never decides those
//    things itself in this mode, matching the real game's server-authoritative
//    turn order (GameData.getTimeExploding() locally times the explosion
//    fade-out and *asks* the server for the next turn via READY_NEXT_TURN,
//    but only NEXT_TURN's arrival actually advances whose turn it is).
//
// Soldier objects are treated as plain data (x, y, angle, alive, exploding,
// timeExplodingStarted, killPosition, color, team) rather than requiring the
// Soldier class's methods, so RoomClient's plain soldier-slot objects work
// here directly — mutating them in place keeps GraphPlane's view and
// RoomClient's own player.soldiers in sync automatically.

import {
  PLANE_LENGTH,
  PLANE_HEIGHT,
  SOLDIER_RADIUS,
  EXPLOSION_RADIUS,
  FUNCTION_VELOCITY,
  FUNC_FADE_TIME,
  NEXT_TURN_DELAY,
  SOLDIER_MAX_DEATH_TIME,
  TEAM1,
  TEAM2,
  NORMAL_FUNC,
  FST_ODE,
  SND_ODE,
} from "./constants.js";
import { Obstacle } from "./obstacle.js";
import { Soldier } from "./soldier.js";
import { Fn } from "./function.js";
import { MalformedFunction } from "./tokens.js";

const TEAM_COLORS = { [TEAM1]: "#3468c0", [TEAM2]: "#c03434" };

export class GraphPlane {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.mode = NORMAL_FUNC;
    this.angle = 0; // player-controlled firing angle, used only in SND_ODE mode
    this.networked = false;

    this.onTurnChange = () => {};
    this.onGameOver = () => {};
    this.onReadyForNextTurn = () => {};

    this._rafHandle = null;
    this._boundTick = this._tick.bind(this);

    this.newMatch();
  }

  newMatch() {
    this.networked = false;
    this.obstacle = new Obstacle(Obstacle.randomCircles());
    this.soldiers = [
      new Soldier(140, PLANE_HEIGHT / 2, TEAM1, TEAM_COLORS[TEAM1]),
      new Soldier(PLANE_LENGTH - 140, PLANE_HEIGHT / 2, TEAM2, TEAM_COLORS[TEAM2]),
    ];
    this.currentShooterSoldier = this.soldiers[0];
    this._resetShotState();
    this.gameOver = false;
  }

  // Builds render/collision state from a RoomClient that has just received
  // START_GAME. Soldier objects are the SAME references RoomClient's
  // NetPlayer instances own (see roomClient.js's makeSoldierSlot shape) —
  // this class mutates them in place rather than copying.
  loadNetworkedMatch(roomClient) {
    this.networked = true;
    this.mode = roomClient.gameMode;
    this.obstacle = new Obstacle(roomClient.obstacleCircles);

    this.soldiers = [];
    for (const player of roomClient.players.values()) {
      for (let i = 0; i < player.numSoldiers; i++) {
        const soldier = player.soldiers[i];
        soldier.color = TEAM_COLORS[player.team] ?? "#888888";
        soldier.team = player.team;
        this.soldiers.push(soldier);
      }
    }

    this.currentShooterSoldier = roomClient.getCurrentTurnPlayer()?.getCurrentTurnSoldier() ?? null;
    this._resetShotState();
    this.gameOver = false;
  }

  _resetShotState() {
    this.func = null;
    this.drawingFunction = false;
    this.exploding = false;
    this.timeStartedDrawingFunction = 0;
    this.timeStartedExploding = 0;
    this.nextTurnSent = false;
  }

  get currentShooter() {
    return this.currentShooterSoldier;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setAngle(radians) {
    this.angle = radians;
  }

  // Local-sandbox fire: computes the shot immediately. Mirrors
  // GameData.fireFunctionMessage + processFunction. Not used in networked
  // mode — there, the shot is only computed once the server relays FIRE_FUNC
  // back (see playShot), even for the local player's own shot.
  fire(functionString) {
    if (this.drawingFunction || this.exploding || this.gameOver) {
      return { ok: false, error: "Wait for the current shot to finish." };
    }

    const shooter = this.currentShooterSoldier;
    const inverted = shooter.team === TEAM2;

    const result = this._computeShot(shooter, functionString, this.mode, this.angle, inverted);
    if (!result.ok) return result;

    this._startShotAnimation(result.fn, shooter);
    return { ok: true };
  }

  // Networked entry point: called once for every FIRE_FUNC this client
  // receives (its own included, since the server relays to everyone).
  playShot(shooterSoldier, functionString, mode, angle, inverted) {
    const result = this._computeShot(shooterSoldier, functionString, mode, angle, inverted);
    if (!result.ok) return result;

    this._startShotAnimation(result.fn, shooterSoldier);
    return { ok: true };
  }

  _computeShot(shooterSoldier, functionString, mode, angle, inverted) {
    let fn;

    try {
      fn = new Fn(functionString);

      if (mode === NORMAL_FUNC) {
        fn.processFunctionRange(this.obstacle, this.soldiers, shooterSoldier, inverted);
      } else if (mode === FST_ODE) {
        fn.processRK4Range(this.obstacle, this.soldiers, shooterSoldier, inverted);
      } else {
        fn.processRK42Range(this.obstacle, this.soldiers, shooterSoldier, angle, inverted);
      }
    } catch (e) {
      if (e instanceof MalformedFunction) {
        return { ok: false, error: e.message };
      }
      throw e;
    }

    return { ok: true, fn };
  }

  _startShotAnimation(fn, shooterSoldier) {
    shooterSoldier.function = fn.strFunc;
    shooterSoldier.angle = fn.fireAngle;
    fn.shooterColor = shooterSoldier.color;

    this.func = fn;
    this.drawingFunction = true;
    this.exploding = false;
    this.nextTurnSent = false;
    this.timeStartedDrawingFunction = performance.now();
  }

  // Called once RoomClient's NEXT_TURN handling picks the next shooter.
  advanceTurn(newShooterSoldier) {
    this.currentShooterSoldier = newShooterSoldier;
    this.onTurnChange(newShooterSoldier);
  }

  setGameOver(winningTeam) {
    this.gameOver = true;
    this.onGameOver(winningTeam);
  }

  start() {
    if (this._rafHandle === null) {
      this._rafHandle = requestAnimationFrame(this._boundTick);
    }
  }

  stop() {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  _tick() {
    this._render();
    this._rafHandle = requestAnimationFrame(this._boundTick);
  }

  // Mirrors GameData.getCurrentFunctionPosition().
  _updateFunctionPosition() {
    if (this.exploding) return this.func.numSteps;

    const elapsed = performance.now() - this.timeStartedDrawingFunction;
    let numDrawSteps = Math.floor((elapsed * FUNCTION_VELOCITY) / 1000);

    if (numDrawSteps > this.func.numSteps && this.drawingFunction) {
      numDrawSteps = this.func.numSteps;

      this.exploding = true;
      this.timeStartedExploding = performance.now();

      this.obstacle.setExplosion(Math.trunc(this.func.lastX), Math.trunc(this.func.lastY), EXPLOSION_RADIUS);
      this.obstacle.explodePoint();
    }

    for (const hit of this.func.soldiersHit) {
      const soldier = hit.soldier;

      if (!soldier.alive) continue;

      if (soldier.exploding) {
        if (performance.now() - soldier.timeExplodingStarted > SOLDIER_MAX_DEATH_TIME) {
          soldier.exploding = false;
        }
      } else if (numDrawSteps > hit.position) {
        soldier.exploding = true;
        soldier.timeExplodingStarted = performance.now();
        soldier.alive = false;
      }
    }

    return numDrawSteps;
  }

  // Mirrors GameData.getTimeExploding(). In local-sandbox mode this decides
  // the next turn itself once NEXT_TURN_DELAY elapses; in networked mode it
  // only ever asks (onReadyForNextTurn) — the actual turn change waits for
  // the server's NEXT_TURN via advanceTurn().
  _updateExplosionTiming() {
    const elapsed = performance.now() - this.timeStartedExploding;

    if (elapsed > NEXT_TURN_DELAY && this.exploding && !this.nextTurnSent) {
      this.nextTurnSent = true;

      if (this.networked) {
        this._resetShotState();
        this.onReadyForNextTurn();
      } else {
        this._nextTurnLocal();
      }
    }

    return elapsed;
  }

  _nextTurnLocal() {
    this._resetShotState();

    const aliveTeams = new Set(this.soldiers.filter((s) => s.alive).map((s) => s.team));

    if (aliveTeams.size <= 1) {
      this.gameOver = true;
      this.onGameOver(this.soldiers.find((s) => s.alive)?.team ?? null);
      return;
    }

    const otherSoldier = this.soldiers.find((s) => s !== this.currentShooterSoldier);
    this.currentShooterSoldier = otherSoldier?.alive ? otherSoldier : this.currentShooterSoldier;
    this.onTurnChange(this.currentShooterSoldier);
  }

  _render() {
    const ctx = this.ctx;

    this._drawBackground(ctx);
    this._drawSoldiers(ctx);
    this._drawFunction(ctx);
    this._drawExplosion(ctx);
  }

  _drawBackground(ctx) {
    ctx.drawImage(this.obstacle.getCanvas(), 0, 0);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, PLANE_HEIGHT / 2);
    ctx.lineTo(PLANE_LENGTH, PLANE_HEIGHT / 2);
    ctx.moveTo(PLANE_LENGTH / 2, 0);
    ctx.lineTo(PLANE_LENGTH / 2, PLANE_HEIGHT);
    ctx.stroke();
  }

  _drawSoldiers(ctx) {
    for (const soldier of this.soldiers) {
      if (!soldier.alive && !soldier.exploding) continue;

      ctx.beginPath();
      ctx.fillStyle = soldier.exploding ? "#888888" : soldier.color;
      ctx.arc(soldier.x, soldier.y, SOLDIER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      if (soldier === this.currentShooterSoldier && !this.drawingFunction && !this.exploding && !this.gameOver) {
        ctx.strokeStyle = "#f2c200";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(soldier.x, soldier.y, SOLDIER_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  _drawFunction(ctx) {
    if (!this.drawingFunction) return;

    const numDrawSteps = this._updateFunctionPosition();

    ctx.save();

    if (this.exploding) {
      const elapsed = this._updateExplosionTiming();

      // _updateExplosionTiming may have just cleared shot state (either
      // local-mode turn advance, or networked-mode onReadyForNextTurn) —
      // nothing left to draw this frame.
      if (this.func === null) {
        ctx.restore();
        return;
      }

      ctx.globalAlpha = Math.max(0, 1 - elapsed / FUNC_FADE_TIME);
    }

    ctx.strokeStyle = this.func.shooterColor ?? "#000000";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.func.getScreenX(0), this.func.getScreenY(0));

    for (let i = 1; i < numDrawSteps; i++) {
      ctx.lineTo(this.func.getScreenX(i), this.func.getScreenY(i));
    }

    ctx.stroke();
    ctx.restore();
  }

  _drawExplosion(ctx) {
    if (!this.exploding) return;

    const elapsed = performance.now() - this.timeStartedExploding;
    const growDuration = 250;
    const radius = EXPLOSION_RADIUS * 2 * Math.min(1, elapsed / growDuration);
    const alpha = Math.max(0, 1 - elapsed / NEXT_TURN_DELAY);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ff8800";
    ctx.beginPath();
    ctx.arc(this.func.lastX, this.func.lastY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
