// Orchestrates LobbyClient -> RoomClient -> GraphPlane. No Java equivalent —
// the original is one continuously-running Swing app with screens hidden/
// shown; this is the DOM-view-switching equivalent for the same flow
// (main menu -> global/lobby screen -> pre-game screen -> game screen).
//
// Simplification: joining a room disconnects the lobby connection entirely,
// rather than keeping both alive the way the real client does (which lets
// the lobby's room list keep showing live player counts for rooms you
// haven't joined). Good enough to prove the core loop; revisit if the lobby
// view needs to stay live during a match.

import { LobbyClient } from "./lobbyClient.js";
import { RoomClient } from "./roomClient.js";
import { GraphPlane } from "./graphPlane.js";
import { NORMAL_FUNC, FST_ODE, SND_ODE, TEAM1, TEAM2, PUBLIC_ROOM_PORT } from "./constants.js";
import { LEVELS, getLevel } from "./levels.js";
import { CLASSROOMS } from "./classrooms.js";

// Hardcoded for now — a teacher-configurable classroom is future work (per-
// classroom codes, room reservations, teacher accounts, etc.), out of scope
// today. "Classroom" mode just locks every room a player joins to this one
// ruleset instead of leaving it open to manual selection like public mode.
const CLASSROOM_LEVEL_ID = 0;
import { PolishNotationFunction } from "./polishNotationFunction.js";
import { isLinear } from "./functionKind.js";
import { MalformedFunction } from "./tokens.js";

const views = {
  landing: document.getElementById("landing-view"),
  classroomSelect: document.getElementById("classroom-select-view"),
  connect: document.getElementById("connect-view"),
  lobby: document.getElementById("lobby-view"),
  pregame: document.getElementById("pregame-view"),
  game: document.getElementById("game-view"),
};

const statusEl = document.getElementById("status");

function showView(name) {
  for (const [key, el] of Object.entries(views)) el.classList.toggle("visible", key === name);
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

let lobbyClient = null;
let roomClient = null;
let bridgeUrl = "";
let gameplayMode = "public"; // "public" | "classroom" — picked on the landing screen
let classroomLevelSent = false;
let selectedClassroom = null;

// ---- Landing view ----

document.getElementById("landing-public").addEventListener("click", () => {
  gameplayMode = "public";
  showView("connect");
});

document.getElementById("landing-classroom").addEventListener("click", () => {
  gameplayMode = "classroom";
  showView("classroomSelect");
});

// ---- Classroom selection ----
// Hardcoded list (see classrooms.js) — just one entry today, but built as a
// list so adding more later is a one-line addition, not a UI rewrite.

const classroomButtonsEl = document.getElementById("classroom-buttons");
for (const classroom of CLASSROOMS) {
  const button = document.createElement("button");
  button.textContent = classroom.label;
  button.addEventListener("click", () => {
    selectedClassroom = classroom;
    showView("connect");
  });
  classroomButtonsEl.appendChild(button);
}

const graphPlane = new GraphPlane(document.getElementById("plane"));
graphPlane.start();

// Console/devtools debugging aid — window.__debug.getRoomClient().players,
// window.__debug.graphPlane.currentShooterSoldier, etc.
window.__debug = { graphPlane, getRoomClient: () => roomClient };

// Default to whatever host the page itself was loaded from, not a hardcoded
// "localhost" — a LAN peer loading this page via the host's LAN IP needs the
// bridge URL to use that same IP, since "localhost" on their machine means
// themselves, not the host. Only applies to local/LAN dev (plain http) —
// over https the page keeps whatever production wss:// bridge URL is baked
// into the HTML, since insecure ws:// from an https page is mixed content
// browsers block outright, and the bridge may live on a different host.
if (location.protocol !== "https:") {
  document.getElementById("bridge-url").value = `ws://${location.hostname}:8082`;
}

// ---- Connect view ----

document.getElementById("connect-button").addEventListener("click", () => {
  bridgeUrl = document.getElementById("bridge-url").value.trim();
  const name = document.getElementById("name-input").value.trim() || "Player";

  // Classroom mode skips the public lobby entirely — everyone who picked
  // the same classroom lands directly in that classroom's fixed room (see
  // classrooms.js), rather than browsing/picking from the shared room list.
  if (gameplayMode === "classroom") {
    joinRoom({ name: selectedClassroom.label, port: PUBLIC_ROOM_PORT + selectedClassroom.roomNum });
    return;
  }

  lobbyClient = new LobbyClient(bridgeUrl);
  lobbyClient.onOpen = () => {
    setStatus(`Connected to lobby as ${name}.`, false);
    showView("lobby");
  };
  lobbyClient.onClose = () => setStatus("Disconnected from lobby.", true);
  lobbyClient.onRoomsChanged = renderRoomList;
  lobbyClient.connect(name);
});

// ---- Level selection (pre-game) ----

const levelSelect = document.getElementById("level-select");
for (const level of LEVELS) {
  const option = document.createElement("option");
  option.value = String(level.id);
  option.textContent = level.label;
  levelSelect.appendChild(option);
}

levelSelect.addEventListener("change", () => {
  if (!roomClient || roomClient.localPlayerId === null) return;
  const levelId = levelSelect.value === "" ? -1 : Number(levelSelect.value);
  roomClient.setLevel(roomClient.localPlayerId, levelId);
});

// Applies both to our own change (echoed back by the server) and to a
// level picked by another player in the room — same trust-based sync used
// for everything else here (see RoomClient.setLevel).
function refreshLevelUI(level) {
  levelSelect.value = level ? String(level.id) : "";
  graphPlane.setLevel(level);
  setStatus(level ? `Level set to: ${level.label}` : "Level set to: Freeplay (no restrictions).", false);
}

function renderRoomList(rooms) {
  const tbody = document.getElementById("room-table-body");
  tbody.innerHTML = "";

  for (const [roomId, room] of rooms) {
    const row = document.createElement("tr");

    const modeLabel = room.gameMode === NORMAL_FUNC ? "Normal" : room.gameMode === FST_ODE ? "1st ODE" : "2nd ODE";

    row.innerHTML = `<td>${room.name}</td><td>${room.numPlayers}</td><td>${modeLabel}</td><td></td>`;

    const joinButton = document.createElement("button");
    joinButton.textContent = "Join";
    joinButton.addEventListener("click", () => joinRoom(room));
    row.lastElementChild.appendChild(joinButton);

    tbody.appendChild(row);
  }
}

// ---- Pre-game view ----

function joinRoom(room) {
  const roomNum = room.port - PUBLIC_ROOM_PORT;
  const name = document.getElementById("name-input").value.trim() || "Player";

  lobbyClient?.disconnect(); // classroom mode never connects to the lobby in the first place
  classroomLevelSent = false;

  const isClassroom = gameplayMode === "classroom";
  document.getElementById("level-row").style.display = isClassroom ? "none" : "";
  document.getElementById("classroom-level-row").style.display = isClassroom ? "" : "none";
  if (isClassroom) document.getElementById("classroom-level-label").textContent = getLevel(CLASSROOM_LEVEL_ID).label;

  roomClient = new RoomClient(bridgeUrl, roomNum);
  roomClient.onOpen = () => {
    roomClient.join(name);
    refreshLevelUI(null); // reset from whatever the previous room's level was
    showView("pregame");
    setStatus(`Joined ${room.name}.`, false);
  };
  roomClient.onClose = () => setStatus("Disconnected from room.", true);
  roomClient.onPlayersChanged = renderPlayerTable;
  roomClient.onLevelChanged = refreshLevelUI;
  roomClient.onChat = (playerId, message) => appendChat(roomClient.players.get(playerId)?.name ?? "?", message);
  roomClient.onCountdown = () => setStatus("Game starting soon...", false);
  roomClient.onGameStart = startNetworkedMatch;
  roomClient.onGameFinished = () => {
    setStatus("Game finished — back to pre-game.", false);
    showView("pregame");
  };
  wireRoomToGraphPlane(roomClient);
  roomClient.connect();
}

// The server (unmodified) starts the game once every currently-connected
// player is ready, with no team-balance check of its own — so an empty
// team is prevented client-side instead: this client refuses to let the
// local player ready up (and un-readies them if teams become imbalanced
// after the fact, e.g. someone switches sides) while either team has zero
// players. As long as everyone's using this client, the server's own
// all-ready check can then never fire while a team is empty.
function bothTeamsHavePlayers() {
  let team1 = false;
  let team2 = false;
  for (const player of roomClient.players.values()) {
    if (player.team === TEAM1) team1 = true;
    else if (player.team === TEAM2) team2 = true;
  }
  return team1 && team2;
}

function renderPlayerTable() {
  const tbody = document.getElementById("player-table-body");
  tbody.innerHTML = "";

  for (const player of roomClient.players.values()) {
    const row = document.createElement("tr");
    const teamLabel = player.team === TEAM2 ? "Red" : "Blue";
    const localMarker = player.local ? " (you)" : "";
    row.innerHTML = `<td>${player.name}${localMarker}</td><td>${teamLabel}</td><td>${player.numSoldiers}</td><td>${player.ready ? "✓" : ""}</td>`;
    tbody.appendChild(row);
  }

  const localPlayer = roomClient.players.get(roomClient.localPlayerId);
  if (!localPlayer) return;

  // Classroom mode locks the level rather than leaving it to manual
  // selection — sent once localPlayerId becomes available (it isn't yet at
  // the moment we join; ADD_PLAYER's echo assigns it asynchronously).
  if (gameplayMode === "classroom" && !classroomLevelSent) {
    classroomLevelSent = true;
    roomClient.setLevel(roomClient.localPlayerId, CLASSROOM_LEVEL_ID);
  }

  if (localPlayer.ready && !bothTeamsHavePlayers()) {
    roomClient.setReady(roomClient.localPlayerId, false);
    setStatus("Need at least 1 player on each team — unreadied.", true);
  }

  document.getElementById("ready-checkbox").checked = localPlayer.ready && bothTeamsHavePlayers();
}

function appendChat(name, message) {
  const log = document.getElementById("chat-log");
  const line = document.createElement("div");
  line.textContent = `${name}: ${message}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

document.getElementById("switch-team").addEventListener("click", () => {
  roomClient?.switchSide(roomClient.localPlayerId);
});

document.getElementById("add-soldier").addEventListener("click", () => {
  roomClient?.addSoldier(roomClient.localPlayerId);
});

document.getElementById("remove-soldier").addEventListener("click", () => {
  roomClient?.removeSoldier(roomClient.localPlayerId);
});

document.getElementById("ready-checkbox").addEventListener("change", (event) => {
  if (!roomClient) return;

  if (event.target.checked && !bothTeamsHavePlayers()) {
    event.target.checked = false;
    setStatus("Need at least 1 player on each team before you can ready up.", true);
    return;
  }

  roomClient.setReady(roomClient.localPlayerId, event.target.checked);
});

document.getElementById("chat-send").addEventListener("click", sendChat);
document.getElementById("chat-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendChat();
});

function sendChat() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || !roomClient) return;
  roomClient.sendChat(roomClient.localPlayerId, text);
  input.value = "";
}

// ---- Game view ----

const MODE_LABELS = { [NORMAL_FUNC]: "y =", [FST_ODE]: "y' =", [SND_ODE]: "y'' =" };
const ANGLE_STEP = (5 * Math.PI) / 180;

function startNetworkedMatch() {
  graphPlane.loadNetworkedMatch(roomClient);
  document.getElementById("func-label").textContent = MODE_LABELS[roomClient.gameMode];
  document.getElementById("angle-controls").classList.toggle("visible", roomClient.gameMode === SND_ODE);
  updateAngleDisplay();
  showView("game");
  setStatus(`Game started. ${roomClient.getCurrentTurnPlayer()?.name ?? "?"} goes first.`, false);
}

function updateAngleDisplay() {
  const degrees = Math.round((graphPlane.angle * 180) / Math.PI);
  document.getElementById("angle-value").textContent = `${degrees}°`;
}

function isMyTurn() {
  return roomClient?.getCurrentTurnPlayer()?.local === true;
}

function adjustAngle(delta) {
  if (roomClient.gameMode !== SND_ODE || !isMyTurn() || graphPlane.drawingFunction) return;

  const player = roomClient.getCurrentTurnPlayer();
  const soldier = player.getCurrentTurnSoldier();
  soldier.angle += delta;
  graphPlane.angle = soldier.angle;
  updateAngleDisplay();

  roomClient.setAngle(player.id, player.currentTurnSoldierIndex, soldier.angle);
}

document.getElementById("angle-up").addEventListener("click", () => adjustAngle(ANGLE_STEP));
document.getElementById("angle-down").addEventListener("click", () => adjustAngle(-ANGLE_STEP));

document.addEventListener("keydown", (event) => {
  if (!views.game.classList.contains("visible")) return;
  if (event.key === "ArrowUp") adjustAngle(ANGLE_STEP);
  else if (event.key === "ArrowDown") adjustAngle(-ANGLE_STEP);
});

document.getElementById("fire").addEventListener("click", () => {
  if (!isMyTurn()) {
    setStatus("Not your turn.", true);
    return;
  }
  if (graphPlane.drawingFunction || graphPlane.exploding) {
    setStatus("Wait for the current shot to finish.", true);
    return;
  }

  const functionString = document.getElementById("function-input").value;

  if (roomClient.level?.allowedKinds?.includes("linear")) {
    try {
      if (!isLinear(new PolishNotationFunction(functionString))) {
        setStatus(`${roomClient.level.label} only allows linear functions, like 2x + 3.`, true);
        return;
      }
    } catch (e) {
      if (!(e instanceof MalformedFunction)) throw e;
      setStatus(e.message, true);
      return;
    }
  }

  roomClient.fireFunction(roomClient.localPlayerId, functionString);
  setStatus(`Fired: ${functionString}`, false);
});

// Wired once here rather than per-match — loadNetworkedMatch resets the
// state these callbacks read, but the callbacks themselves don't change.
graphPlane.onReadyForNextTurn = () => {
  if (roomClient.checkGameFinished()) roomClient.reportGameFinished();
  else roomClient.readyNextTurn();
};

function wireRoomToGraphPlane(client) {
  client.onFire = (shooterPlayer, shooterSoldier, functionString) => {
    const inverted = shooterPlayer.team === TEAM2;
    const result = graphPlane.playShot(shooterSoldier, functionString, client.gameMode, shooterSoldier.angle, inverted);
    if (!result.ok) console.error("playShot failed:", result.error);
  };

  client.onTurnAdvance = (player) => {
    graphPlane.advanceTurn(player?.getCurrentTurnSoldier() ?? null);
    setStatus(`${player?.name ?? "?"}'s turn.`, false);
  };
}
