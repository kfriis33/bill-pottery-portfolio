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
import { NORMAL_FUNC, FST_ODE, SND_ODE, TEAM2, PUBLIC_ROOM_PORT } from "./constants.js";

const views = {
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

  lobbyClient = new LobbyClient(bridgeUrl);
  lobbyClient.onOpen = () => {
    setStatus(`Connected to lobby as ${name}.`, false);
    showView("lobby");
  };
  lobbyClient.onClose = () => setStatus("Disconnected from lobby.", true);
  lobbyClient.onRoomsChanged = renderRoomList;
  lobbyClient.connect(name);
});

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

  lobbyClient.disconnect();

  roomClient = new RoomClient(bridgeUrl, roomNum);
  roomClient.onOpen = () => {
    roomClient.join(name);
    showView("pregame");
    setStatus(`Joined ${room.name}.`, false);
  };
  roomClient.onClose = () => setStatus("Disconnected from room.", true);
  roomClient.onPlayersChanged = renderPlayerTable;
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
  if (localPlayer) document.getElementById("ready-checkbox").checked = localPlayer.ready;
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
  roomClient?.setReady(roomClient.localPlayerId, event.target.checked);
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
