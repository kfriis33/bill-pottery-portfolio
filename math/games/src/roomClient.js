// Ported from the client side of the room protocol — see
// src/Graphwar/GameData.java (message handlers + the sendMessage call
// sites) and src/GraphServer/GraphServer.java (server-side field layouts,
// checked directly since GameData's parsing is the real contract but the
// server's construction code is what pins down field order for messages
// this client only ever receives, like START_GAME).
//
// Ordering assumption: START_GAME assigns soldier coordinates by iterating
// GraphServer's flat `players` list (join order across all connections), not
// per-connection. This client assumes one player per connection (no local
// multiplayer/hotseat), so the order it receives ADD_PLAYER messages in —
// which it preserves via an insertion-ordered Map — matches that flat list.
// A client that added multiple local players out of global join order would
// need REORDER (code 43) support to stay in sync; that message isn't
// implemented here.

import { Protocol, javaUrlDecode, javaUrlEncode } from "./netProtocol.js";
import { LineSocket } from "./lineSocket.js";
import * as Constants from "./constants.js";
import { getLevel, LEVEL_SYNC_PREFIX } from "./levels.js";

function makeSoldierSlot() {
  return { x: 0, y: 0, angle: 0, alive: false, exploding: false, timeExplodingStarted: 0, killPosition: 0 };
}

class NetPlayer {
  constructor(id, name, team, local, numSoldiers, ready) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.local = local;
    this.numSoldiers = numSoldiers;
    this.ready = ready;
    this.disconnected = false;

    // Fixed-size like Graphwar/Player.java's soldiers array — only the
    // first `numSoldiers` slots are meaningful until REMOVE_SOLDIER/
    // ADD_SOLDIER change that count.
    this.soldiers = Array.from({ length: Constants.MAX_SOLDIERS_PER_PLAYER }, makeSoldierSlot);
    this.currentTurnSoldierIndex = 0;
  }

  getCurrentTurnSoldier() {
    return this.soldiers[this.currentTurnSoldierIndex];
  }

  restartTurn() {
    this.currentTurnSoldierIndex = 0;
  }

  // Ported from Player.nextTurn(): cycles to this player's next living
  // soldier; returns false if none are alive (the caller then moves on to
  // the next player).
  advanceSoldier() {
    for (let i = 0; i < this.numSoldiers; i++) {
      this.currentTurnSoldierIndex = (this.currentTurnSoldierIndex + 1) % this.numSoldiers;
      if (this.soldiers[this.currentTurnSoldierIndex].alive) return true;
    }
    return false;
  }
}

export class RoomClient {
  constructor(bridgeUrl, roomNum) {
    this.bridgeUrl = bridgeUrl;
    this.roomNum = roomNum;

    this.players = new Map(); // id -> NetPlayer, insertion-ordered
    this.localPlayerId = null;
    this.isLeader = false;
    this.gameMode = Constants.NORMAL_FUNC;
    this.gameState = Constants.PRE_GAME;
    this.obstacleCircles = [];
    this.currentTurnPlayerId = null;
    this.level = null; // teaching-level restriction, synced via chat piggyback — see setLevel/_handleLine

    this.onPlayersChanged = () => {};
    this.onModeChanged = () => {};
    this.onLeader = () => {};
    this.onLevelChanged = () => {}; // (level) — level is null for freeplay
    this.onChat = () => {};
    this.onCountdown = () => {};
    this.onGameStart = () => {};
    this.onFire = () => {}; // (shooterPlayer, shooterSoldier, functionString)
    this.onTurnAdvance = () => {}; // (currentTurnPlayer)
    this.onAngle = () => {}; // (player, soldierIndex, angle)
    this.onGameFinished = () => {};
    this.onOpen = () => {};
    this.onClose = () => {};
  }

  connect() {
    this.socket = new LineSocket(`${this.bridgeUrl}/room/${this.roomNum}`);
    this.socket.onOpen = () => this.onOpen();
    this.socket.onLine = (line) => this._handleLine(line);
    this.socket.onClose = () => this.onClose();
  }

  // No name/handshake line needed here — unlike the lobby, a room
  // connection starts receiving ALL_INFO-equivalent messages immediately
  // (see GraphServer.addClient). Call this once connected to become a
  // player in the room.
  join(name) {
    this.socket.send(`${Protocol.ADD_PLAYER}&${javaUrlEncode(name)}`);
  }

  addSoldier(playerId) {
    this.socket.send(`${Protocol.ADD_SOLDIER}&${playerId}`);
  }

  removeSoldier(playerId) {
    this.socket.send(`${Protocol.REMOVE_SOLDIER}&${playerId}`);
  }

  switchSide(playerId) {
    const player = this.players.get(playerId);
    const otherTeam = player.team === Constants.TEAM1 ? Constants.TEAM2 : Constants.TEAM1;
    this.socket.send(`${Protocol.SET_TEAM}&${otherTeam}&${playerId}`);
  }

  setReady(playerId, ready) {
    this.socket.send(`${Protocol.SET_READY}&${playerId}&${ready ? 1 : 0}`);
  }

  sendChat(playerId, message) {
    this.socket.send(`${Protocol.CHAT_MSG}&${playerId}&${javaUrlEncode(message)}`);
  }

  // No dedicated wire message exists for arbitrary room state, so this
  // piggybacks on chat (see LEVEL_SYNC_PREFIX in levels.js) — the server
  // just relays it to everyone in the room like any other chat line, and
  // _handleLine below recognizes and applies it instead of surfacing it as
  // a visible chat message (including on the sender's own client, via the
  // server's echo-back — the same trust model already used for FIRE_FUNC).
  setLevel(playerId, levelId) {
    this.sendChat(playerId, `${LEVEL_SYNC_PREFIX}${levelId}`);
  }

  fireFunction(playerId, functionString) {
    this.socket.send(`${Protocol.FIRE_FUNC}&${playerId}&${javaUrlEncode(functionString)}`);
  }

  setAngle(playerId, soldierIndex, angle) {
    this.socket.send(`${Protocol.SET_ANGLE}&${playerId}&${soldierIndex}&${angle}`);
  }

  readyNextTurn() {
    this.socket.send(`${Protocol.READY_NEXT_TURN}`);
  }

  // Ported from GameData.checkGameFinished(): true once one whole team has
  // no soldiers left alive. Each client checks this itself and reports
  // GAME_FINISHED instead of READY_NEXT_TURN when true (see nextTurn() in
  // the original) — the server doesn't decide this on its own.
  checkGameFinished() {
    let team1Alive = false;
    let team2Alive = false;

    for (const player of this.players.values()) {
      for (let i = 0; i < player.numSoldiers; i++) {
        if (!player.soldiers[i].alive) continue;
        if (player.team === Constants.TEAM1) team1Alive = true;
        else team2Alive = true;
      }
    }

    return !team1Alive || !team2Alive;
  }

  reportGameFinished() {
    this.socket.send(`${Protocol.GAME_FINISHED}`);
  }

  getCurrentTurnPlayer() {
    return this.players.get(this.currentTurnPlayerId) ?? null;
  }

  _handleLine(line) {
    const fields = line.split("&");
    const code = Number(fields[0]);

    switch (code) {
      case Protocol.NO_INFO:
        break;

      case Protocol.SET_MODE: {
        this.gameMode = Number(fields[1]);
        this.onModeChanged(this.gameMode);
        break;
      }

      case Protocol.NEW_LEADER: {
        this.isLeader = true;
        this.onLeader();
        break;
      }

      case Protocol.ADD_PLAYER: {
        const [, id, name, team, local, numSoldiers, ready] = fields;
        const playerId = Number(id);
        const player = new NetPlayer(
          playerId,
          javaUrlDecode(name),
          Number(team),
          Number(local) !== 0,
          Number(numSoldiers),
          Number(ready) !== 0,
        );
        if (player.local) this.localPlayerId = playerId;
        this.players.set(playerId, player);
        this.onPlayersChanged();
        break;
      }

      case Protocol.REMOVE_PLAYER: {
        this.players.delete(Number(fields[1]));
        this.onPlayersChanged();
        break;
      }

      case Protocol.ADD_SOLDIER: {
        const player = this.players.get(Number(fields[1]));
        if (player) {
          player.numSoldiers++;
          this.onPlayersChanged();
        }
        break;
      }

      case Protocol.REMOVE_SOLDIER: {
        const player = this.players.get(Number(fields[1]));
        if (player) {
          player.numSoldiers--;
          this.onPlayersChanged();
        }
        break;
      }

      case Protocol.SET_TEAM: {
        const [, team, playerId] = fields;
        const player = this.players.get(Number(playerId));
        if (player) {
          player.team = Number(team);
          this.onPlayersChanged();
        }
        break;
      }

      case Protocol.SET_READY: {
        const [, playerId, ready] = fields;
        const player = this.players.get(Number(playerId));
        if (player) {
          player.ready = Number(ready) !== 0;
          this.onPlayersChanged();
        }
        break;
      }

      case Protocol.CHAT_MSG: {
        const [, playerId, message] = fields;
        const decoded = javaUrlDecode(message);

        if (decoded.startsWith(LEVEL_SYNC_PREFIX)) {
          this.level = getLevel(Number(decoded.slice(LEVEL_SYNC_PREFIX.length)));
          this.onLevelChanged(this.level);
          break;
        }

        this.onChat(Number(playerId), decoded);
        break;
      }

      case Protocol.START_COUNTDOWN: {
        this.onCountdown();
        break;
      }

      // The server reshuffles its player order right before a match to
      // alternate teams (fairness in turn order) — see reorderPlayers() in
      // GraphServer.java, called from startGame() just before it generates
      // circles/soldiers and builds START_GAME using that new order. This
      // MUST be applied before parsing START_GAME, or soldier coordinates
      // get assigned to the wrong players (each block of coordinates is
      // positional, not tagged by player id).
      case Protocol.REORDER: {
        const reordered = new Map();
        for (let i = 1; i < fields.length; i++) {
          const id = Number(fields[i]);
          reordered.set(id, this.players.get(id));
        }
        this.players = reordered;
        this.onPlayersChanged();
        break;
      }

      case Protocol.START_GAME: {
        this._handleStartGame(fields);
        break;
      }

      case Protocol.NEXT_TURN: {
        this._advanceTurn();
        break;
      }

      case Protocol.FIRE_FUNC: {
        const [, playerId, functionString] = fields;
        const player = this.players.get(Number(playerId));
        if (player) this.onFire(player, player.getCurrentTurnSoldier(), javaUrlDecode(functionString));
        break;
      }

      case Protocol.SET_ANGLE: {
        const [, playerId, soldierIndex, angle] = fields;
        const player = this.players.get(Number(playerId));
        if (player) {
          player.soldiers[Number(soldierIndex)].angle = Number(angle);
          this.onAngle(player, Number(soldierIndex), Number(angle));
        }
        break;
      }

      case Protocol.GAME_FINISHED: {
        this.gameState = Constants.PRE_GAME;
        for (const player of this.players.values()) player.ready = false;
        this.onGameFinished();
        break;
      }

      default:
        break;
    }
  }

  _handleStartGame(fields) {
    this.gameState = Constants.GAME;

    const numCircles = Number(fields[1]);
    this.obstacleCircles = [];
    for (let i = 0; i < numCircles; i++) {
      const base = 2 + i * 3;
      this.obstacleCircles.push({ x: Number(fields[base]), y: Number(fields[base + 1]), radius: Number(fields[base + 2]) });
    }

    let cursor = 2 + numCircles * 3;
    for (const player of this.players.values()) {
      for (let s = 0; s < player.numSoldiers; s++) {
        const x = Number(fields[cursor]);
        const y = Number(fields[cursor + 1]);
        cursor += 2;
        player.soldiers[s] = { ...makeSoldierSlot(), x, y, alive: true };
      }
      player.restartTurn();
    }

    const playerIds = [...this.players.keys()];
    const startIndex = Math.abs(Number(fields[cursor])) % playerIds.length;
    this.currentTurnPlayerId = playerIds[startIndex];

    this.onGameStart();
  }

  // Ported from GameData.nextTurnMessage(): cycle forward through players
  // (wrapping), and within the landed-on player cycle their own soldiers,
  // until one with a living soldier is found.
  _advanceTurn() {
    if (this.checkGameFinished()) this.reportGameFinished();

    const playerIds = [...this.players.keys()];
    let index = playerIds.indexOf(this.currentTurnPlayerId);

    for (let i = 0; i < playerIds.length; i++) {
      index = (index + 1) % playerIds.length;
      const player = this.players.get(playerIds[index]);
      if (player.advanceSoldier()) {
        this.currentTurnPlayerId = playerIds[index];
        break;
      }
    }

    this.onTurnAdvance(this.getCurrentTurnPlayer());
  }

  disconnect() {
    this.socket?.close();
  }
}
