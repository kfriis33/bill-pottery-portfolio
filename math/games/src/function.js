// Ported from src/Graphwar/Function.java — the trajectory engine.
//
// Simplified from the original: the Java version takes a `Player[]` where
// each player owns multiple soldiers, and records hits as
// (playerIndex, soldierIndex) pairs. This prototype has no concept of
// "players" yet, only a flat list of soldiers, so hits are recorded as
// direct soldier references instead. The numeric trajectory algorithm
// (coordinate conversion, adaptive step halving, RK4 integration, hit
// testing, angle solving) is an unmodified line-for-line port.
//
// One deliberate deviation: in the original, `lastX`/`lastY` are left
// un-mirrored by processFunctionRange/RK4Range/RK42Range even when
// `inverted` is true — the caller (GameData, via isFunctionReversed) decides
// separately whether to mirror them for display, because the real game also
// mirrors each player's entire view so they always see themselves on the
// left. This prototype has a single objective viewpoint (team1 truly on the
// left, team2 truly on the right, no per-viewer mirroring), so that second
// mirroring step collapses into this one: lastX/lastY here are already
// mirrored back to the correct physical side whenever `inverted` is true.

import {
  PLANE_LENGTH,
  PLANE_HEIGHT,
  PLANE_GAME_LENGTH,
  SOLDIER_RADIUS,
  FUNC_MAX_STEPS,
  FUNC_MAX_STEP_DISTANCE_SQUARED,
  FUNC_MIN_X_STEP_DISTANCE,
  STEP_SIZE,
  ANGLE_ERROR,
  MAX_ANGLE_LOOPS,
} from "./constants.js";
import { PolishNotationFunction } from "./polishNotationFunction.js";

function toGameX(screenX) {
  return (PLANE_GAME_LENGTH * (screenX - PLANE_LENGTH / 2)) / PLANE_LENGTH;
}

function toGameY(screenY) {
  return (PLANE_GAME_LENGTH * (-screenY + PLANE_HEIGHT / 2)) / PLANE_LENGTH;
}

// Exported for GraphPlane's grid-line rendering, so grid spacing lines up
// with the same game-unit coordinate system a fired function is graphed in
// (see graphPlane.js's _drawBackground), rather than an arbitrary pixel grid.
export function toScreenX(gameX) {
  return (PLANE_LENGTH * gameX) / PLANE_GAME_LENGTH + PLANE_LENGTH / 2;
}

export function toScreenY(gameY) {
  return (-PLANE_LENGTH * gameY) / PLANE_GAME_LENGTH + PLANE_HEIGHT / 2;
}

export class Fn {
  constructor(str) {
    this.strFunc = str;
    this.polishFunc = new PolishNotationFunction(str);

    this.fireAngle = 0;
    this.valuesX = null;
    this.valuesY = null;
    this.valuesDY = null;
    this.numSteps = 0;

    this.soldiersHit = [];

    this.lastX = 0;
    this.lastY = 0;
  }

  getX(index) {
    return this.valuesX[index];
  }

  getY(index) {
    return this.valuesY[index];
  }

  // Screen-space coordinates for step `index`, already mirrored back to the
  // physically correct side when the shot was fired inverted (see the file
  // header comment on the lastX/lastY deviation — same reasoning applies
  // here, and is why these arrays exist alongside valuesX/valuesY rather
  // than making the renderer redo the conversion).
  getScreenX(index) {
    return this.screenX[index];
  }

  getScreenY(index) {
    return this.screenY[index];
  }

  _soldierAlreadyHit(soldier) {
    return this.soldiersHit.some((hit) => hit.soldier === soldier);
  }

  _checkHits(soldiers, shooterSoldier, screenX, screenY, stepIndex) {
    for (const soldier of soldiers) {
      if (soldier === shooterSoldier || !soldier.alive) continue;
      if (this._soldierAlreadyHit(soldier)) continue;

      const distX = soldier.x - screenX;
      const distY = soldier.y - screenY;
      const distSquared = distX * distX + distY * distY;

      if (distSquared < SOLDIER_RADIUS * SOLDIER_RADIUS) {
        this.soldiersHit.push({ soldier, position: stepIndex });
      }
    }
  }

  _getStartAngle(x, radius) {
    let angle = 0;
    let error = 10000;

    for (let i = 0; error > ANGLE_ERROR && i < MAX_ANGLE_LOOPS; i++) {
      const finalX = x + radius * Math.cos(angle);
      const tangent =
        (this.polishFunc.evaluateFunction(finalX + STEP_SIZE, 0, 0) - this.polishFunc.evaluateFunction(finalX, 0, 0)) /
        STEP_SIZE;

      const newAngle = Math.atan(tangent);
      error = Math.abs(newAngle - angle);
      angle = newAngle;
    }

    return angle;
  }

  // Game mode: Normal Function — y = f(x) + offset, offset chosen so the
  // curve passes through the firing soldier.
  processFunctionRange(obstacle, soldiers, shooterSoldier, inverted) {
    this.soldiersHit = [];
    this.valuesX = new Float64Array(FUNC_MAX_STEPS);
    this.valuesY = new Float64Array(FUNC_MAX_STEPS);
    this.screenX = new Float64Array(FUNC_MAX_STEPS);
    this.screenY = new Float64Array(FUNC_MAX_STEPS);

    let startX = shooterSoldier.x;
    const startYScreen = shooterSoldier.y;

    if (inverted) startX = PLANE_LENGTH - startX;

    this.valuesX[0] = toGameX(startX);
    this.valuesY[0] = toGameY(startYScreen);

    const gameRadius = (PLANE_GAME_LENGTH * SOLDIER_RADIUS) / PLANE_LENGTH;
    this.fireAngle = this._getStartAngle(this.valuesX[0], gameRadius);

    if (Number.isFinite(this.fireAngle)) {
      this.valuesX[0] += gameRadius * Math.cos(this.fireAngle);
      this.valuesY[0] += gameRadius * Math.sin(this.fireAngle);
    }

    this.screenX[0] = inverted ? PLANE_LENGTH - toScreenX(this.valuesX[0]) : toScreenX(this.valuesX[0]);
    this.screenY[0] = toScreenY(this.valuesY[0]);

    const offset = -this.polishFunc.evaluateFunction(this.valuesX[0], 0, 0) + this.valuesY[0];

    this.numSteps = FUNC_MAX_STEPS;

    for (let i = 1; i < FUNC_MAX_STEPS; i++) {
      let stepSize = STEP_SIZE;

      this.valuesX[i] = this.valuesX[i - 1] + stepSize;
      this.valuesY[i] = this.polishFunc.evaluateFunction(this.valuesX[i], 0, 0) + offset;

      let endFunc = false;

      while (
        (this.valuesX[i] - this.valuesX[i - 1]) ** 2 + (this.valuesY[i] - this.valuesY[i - 1]) ** 2 >
        FUNC_MAX_STEP_DISTANCE_SQUARED
      ) {
        if (this.valuesX[i] - this.valuesX[i - 1] > FUNC_MIN_X_STEP_DISTANCE) {
          stepSize /= 2;
          this.valuesX[i] = this.valuesX[i - 1] + stepSize;
          this.valuesY[i] = this.polishFunc.evaluateFunction(this.valuesX[i], 0, 0) + offset;
        } else {
          endFunc = true;
          break;
        }
      }

      if (endFunc) {
        this.numSteps = i;
        break;
      }

      let x = toScreenX(this.valuesX[i]);
      const y = toScreenY(this.valuesY[i]);
      if (inverted) x = PLANE_LENGTH - x;

      this.screenX[i] = x;
      this.screenY[i] = y;

      this._checkHits(soldiers, shooterSoldier, x, y, i);

      if (obstacle.collidePoint(Math.trunc(x), Math.trunc(y))) {
        this.numSteps = i;
        break;
      }

      if (!Number.isFinite(y)) {
        this.numSteps = i;
        break;
      }
    }

    this.lastX = toScreenX(this.valuesX[this.numSteps - 1]);
    this.lastY = toScreenY(this.valuesY[this.numSteps - 1]);
    if (inverted) this.lastX = PLANE_LENGTH - this.lastX;
  }

  _getRK4StartAngle(x, y, radius) {
    let angle = 0;
    let error = 10000;
    const stepSize = STEP_SIZE;

    for (let i = 0; error > ANGLE_ERROR && i < MAX_ANGLE_LOOPS; i++) {
      const finalX = x + radius * Math.cos(angle);
      const finalY = y + radius * Math.sin(angle);

      const k1 = this.polishFunc.evaluateFunction(finalX, finalY, 0);
      const k2 = this.polishFunc.evaluateFunction(finalX + 0.5 * stepSize, finalY + 0.5 * stepSize * k1, 0);
      const k3 = this.polishFunc.evaluateFunction(finalX + 0.5 * stepSize, finalY + 0.5 * stepSize * k2, 0);
      const k4 = this.polishFunc.evaluateFunction(finalX + stepSize, finalY + stepSize * k3, 0);

      const nextY = finalY + (stepSize / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      const nextX = finalX + stepSize;

      const newAngle = Math.atan((nextY - finalY) / (nextX - finalX));
      error = Math.abs(newAngle - angle);
      angle = newAngle;
    }

    return angle;
  }

  // Game mode: 1st order ODE — y' = f(x, y), integrated with RK4. The
  // soldier's position is the initial condition.
  processRK4Range(obstacle, soldiers, shooterSoldier, inverted) {
    this.soldiersHit = [];
    this.valuesX = new Float64Array(FUNC_MAX_STEPS);
    this.valuesY = new Float64Array(FUNC_MAX_STEPS);
    this.screenX = new Float64Array(FUNC_MAX_STEPS);
    this.screenY = new Float64Array(FUNC_MAX_STEPS);

    let startX = shooterSoldier.x;
    const startYScreen = shooterSoldier.y;
    if (inverted) startX = PLANE_LENGTH - startX;

    this.valuesX[0] = toGameX(startX);
    this.valuesY[0] = toGameY(startYScreen);

    const gameRadius = (PLANE_GAME_LENGTH * SOLDIER_RADIUS) / PLANE_LENGTH;
    this.fireAngle = this._getRK4StartAngle(this.valuesX[0], this.valuesY[0], gameRadius);

    this.valuesX[0] += gameRadius * Math.cos(this.fireAngle);
    this.valuesY[0] += gameRadius * Math.sin(this.fireAngle);

    this.screenX[0] = inverted ? PLANE_LENGTH - toScreenX(this.valuesX[0]) : toScreenX(this.valuesX[0]);
    this.screenY[0] = toScreenY(this.valuesY[0]);

    const rk4Step = (x, y, h) => {
      const k1 = this.polishFunc.evaluateFunction(x, y, 0);
      const k2 = this.polishFunc.evaluateFunction(x + 0.5 * h, y + 0.5 * h * k1, 0);
      const k3 = this.polishFunc.evaluateFunction(x + 0.5 * h, y + 0.5 * h * k2, 0);
      const k4 = this.polishFunc.evaluateFunction(x + h, y + h * k3, 0);
      return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    };

    this.numSteps = FUNC_MAX_STEPS;

    for (let i = 1; i < FUNC_MAX_STEPS; i++) {
      let stepSize = STEP_SIZE;

      this.valuesY[i] = rk4Step(this.valuesX[i - 1], this.valuesY[i - 1], stepSize);
      this.valuesX[i] = this.valuesX[i - 1] + stepSize;

      // Matches the original: the halving loop's exit condition already
      // requires dx > FUNC_MIN_X_STEP_DISTANCE to keep looping, so there is
      // no separate "step too small" early-exit for this mode (unlike
      // processFunctionRange) — a steep function here runs to FUNC_MAX_STEPS
      // or a NaN/Infinity instead of ending early.
      while (
        (this.valuesX[i] - this.valuesX[i - 1]) ** 2 + (this.valuesY[i] - this.valuesY[i - 1]) ** 2 >
          FUNC_MAX_STEP_DISTANCE_SQUARED &&
        this.valuesX[i] - this.valuesX[i - 1] > FUNC_MIN_X_STEP_DISTANCE
      ) {
        stepSize /= 2;
        this.valuesY[i] = rk4Step(this.valuesX[i - 1], this.valuesY[i - 1], stepSize);
        this.valuesX[i] = this.valuesX[i - 1] + stepSize;
      }

      let x = toScreenX(this.valuesX[i]);
      const y = toScreenY(this.valuesY[i]);
      if (inverted) x = PLANE_LENGTH - x;

      this.screenX[i] = x;
      this.screenY[i] = y;

      this._checkHits(soldiers, shooterSoldier, x, y, i);

      if (obstacle.collidePoint(Math.trunc(x), Math.trunc(y))) {
        this.numSteps = i;
        break;
      }

      if (!Number.isFinite(y)) {
        this.numSteps = i;
        break;
      }
    }

    this.lastX = toScreenX(this.valuesX[this.numSteps - 1]);
    this.lastY = toScreenY(this.valuesY[this.numSteps - 1]);
    if (inverted) this.lastX = PLANE_LENGTH - this.lastX;
  }

  // Game mode: 2nd order ODE — y'' = f(x, y, y'), integrated with RK4 over
  // the state vector (y, y'). The firing angle is player-controlled (up/down)
  // rather than solved for, and doubles as the second initial condition.
  processRK42Range(obstacle, soldiers, shooterSoldier, angle, inverted) {
    this.soldiersHit = [];
    this.valuesX = new Float64Array(FUNC_MAX_STEPS);
    this.valuesY = new Float64Array(FUNC_MAX_STEPS);
    this.valuesDY = new Float64Array(FUNC_MAX_STEPS);
    this.screenX = new Float64Array(FUNC_MAX_STEPS);
    this.screenY = new Float64Array(FUNC_MAX_STEPS);

    let startX = shooterSoldier.x;
    if (inverted) startX = PLANE_LENGTH - startX;
    startX += SOLDIER_RADIUS * Math.cos(angle);

    let startYScreen = shooterSoldier.y;
    startYScreen -= SOLDIER_RADIUS * Math.sin(angle);

    this.valuesX[0] = toGameX(startX);
    this.valuesY[0] = toGameY(startYScreen);
    this.valuesDY[0] = Math.tan(angle);
    this.fireAngle = angle;

    this.screenX[0] = inverted ? PLANE_LENGTH - toScreenX(this.valuesX[0]) : toScreenX(this.valuesX[0]);
    this.screenY[0] = toScreenY(this.valuesY[0]);

    const rk4Step = (x, y, dy, h) => {
      const k11 = dy;
      const k12 = this.polishFunc.evaluateFunction(x, y, dy);

      const x1 = x + h / 2;
      const y1 = y + (h / 2) * k11;
      const dy1 = dy + (h / 2) * k12;

      const k21 = dy1;
      const k22 = this.polishFunc.evaluateFunction(x1, y1, dy1);

      const y2 = y + (h / 2) * k21;
      const dy2 = dy + (h / 2) * k22;

      const k31 = dy2;
      const k32 = this.polishFunc.evaluateFunction(x1, y2, dy2);

      const x3 = x + h;
      const y3 = y + h * k31;
      const dy3 = dy + h * k32;

      const k41 = dy3;
      const k42 = this.polishFunc.evaluateFunction(x3, y3, dy3);

      return {
        y: y + (h / 6) * (k11 + 2 * k21 + 2 * k31 + k41),
        dy: dy + (h / 6) * (k12 + 2 * k22 + 2 * k32 + k42),
      };
    };

    this.numSteps = FUNC_MAX_STEPS;

    for (let i = 1; i < FUNC_MAX_STEPS; i++) {
      let stepSize = STEP_SIZE;

      let next = rk4Step(this.valuesX[i - 1], this.valuesY[i - 1], this.valuesDY[i - 1], stepSize);
      this.valuesX[i] = this.valuesX[i - 1] + stepSize;
      this.valuesY[i] = next.y;
      this.valuesDY[i] = next.dy;

      // See processRK4Range: no separate "step too small" early-exit here,
      // matching the original's (likely unintentional) dead-code behavior.
      while (
        (this.valuesX[i] - this.valuesX[i - 1]) ** 2 + (this.valuesY[i] - this.valuesY[i - 1]) ** 2 >
          FUNC_MAX_STEP_DISTANCE_SQUARED &&
        this.valuesX[i] - this.valuesX[i - 1] > FUNC_MIN_X_STEP_DISTANCE
      ) {
        stepSize /= 2;
        next = rk4Step(this.valuesX[i - 1], this.valuesY[i - 1], this.valuesDY[i - 1], stepSize);
        this.valuesX[i] = this.valuesX[i - 1] + stepSize;
        this.valuesY[i] = next.y;
        this.valuesDY[i] = next.dy;
      }

      let x = toScreenX(this.valuesX[i]);
      const y = toScreenY(this.valuesY[i]);
      if (inverted) x = PLANE_LENGTH - x;

      this.screenX[i] = x;
      this.screenY[i] = y;

      this._checkHits(soldiers, shooterSoldier, x, y, i);

      if (obstacle.collidePoint(Math.trunc(x), Math.trunc(y))) {
        this.numSteps = i;
        break;
      }

      if (!Number.isFinite(y)) {
        this.numSteps = i;
        break;
      }
    }

    this.lastX = toScreenX(this.valuesX[this.numSteps - 1]);
    this.lastY = toScreenY(this.valuesY[this.numSteps - 1]);
    if (inverted) this.lastX = PLANE_LENGTH - this.lastX;
  }
}
