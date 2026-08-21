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
import { NORMAL_FUNC, FST_ODE, SND_ODE, TEAM1, TEAM2, PUBLIC_ROOM_PORT, PRE_GAME } from "./constants.js";
import { LEVELS, getLevel } from "./levels.js";
import { CLASSROOMS } from "./classrooms.js";
import { PolishNotationFunction } from "./polishNotationFunction.js";
import { isLinear } from "./functionKind.js";
import { MalformedFunction } from "./tokens.js";
import { selectMatch, SERVER_START_GAME_DELAY_MS } from "./matchmaking.js";
import { SOLDIER_SKINS, ARTILLERY_SKINS, getSoldierSkin, setSoldierSkin, getArtillerySkin, setArtillerySkin } from "./skins.js";
import { StatEvent } from "./stats.js";

// Hardcoded for now — a teacher-configurable classroom is future work (per-
// classroom codes, room reservations, teacher accounts, etc.), out of scope
// today. "Classroom" mode just locks every room a player joins to this one
// ruleset instead of leaving it open to manual selection like public mode.
const CLASSROOM_LEVEL_ID = 0;

const views = {
  landing: document.getElementById("landing-view"),
  teacherPassword: document.getElementById("teacher-password-view"),
  classroomSelect: document.getElementById("classroom-select-view"),
  connect: document.getElementById("connect-view"),
  lobby: document.getElementById("lobby-view"),
  pregame: document.getElementById("pregame-view"),
  waiting: document.getElementById("waiting-view"),
  teacherView: document.getElementById("teacher-view"),
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
let teacherRoomClient = null;
let bridgeUrl = "";
let gameplayMode = "public"; // "public" | "classroom" — picked on the landing screen
let leadMode = false; // true once "Lead a Classroom" + the password have been accepted
let classroomLevelSent = false;
let classroomSkinSent = false;
let selectedClassroom = null;
let pendingMatch = null; // leader-only orchestration state — see checkMatchmaking()
let matchQueue = []; // leader-local matchmaking priority order — see checkMatchmaking()
let myTeammateNameForCountdown = null; // set by handleMatchFormed, consumed once by the next onCountdown
let countdownRaf = null;
let leaderboardTimer = null;

// Hardcoded for now — no teacher accounts exist yet (see classrooms.js's
// own note on that). One shared password for every classroom.
const TEACHER_PASSWORD = "PUMA";

// ---- Back buttons ----

document.getElementById("back-from-classroom-select").addEventListener("click", () => {
  showView(leadMode ? "teacherPassword" : "landing");
});

document.getElementById("back-from-teacher-password").addEventListener("click", () => {
  leadMode = false;
  showView("landing");
});

document.getElementById("back-from-connect").addEventListener("click", () => {
  showView(gameplayMode === "classroom" ? "classroomSelect" : "landing");
});

document.getElementById("back-from-lobby").addEventListener("click", () => {
  lobbyClient?.disconnect();
  showView("connect");
});

document.getElementById("back-from-pregame").addEventListener("click", () => {
  roomClient?.disconnect();
  showView("lobby");
});

document.getElementById("back-from-waiting").addEventListener("click", () => {
  stopLeaderboardPolling();
  pendingMatch = null;
  roomClient?.disconnect();
  showView("classroomSelect");
});

document.getElementById("back-from-teacher").addEventListener("click", () => {
  stopLeaderboardPolling();
  disconnectTeacherSpectator();
  showView("classroomSelect");
});

// ---- Landing view ----

document.getElementById("landing-public").addEventListener("click", () => {
  gameplayMode = "public";
  showView("connect");
});

document.getElementById("landing-classroom").addEventListener("click", () => {
  gameplayMode = "classroom";
  leadMode = false;
  showView("classroomSelect");
});

document.getElementById("landing-teacher").addEventListener("click", () => {
  document.getElementById("teacher-password-input").value = "";
  showView("teacherPassword");
});

// ---- Teacher password ----

function submitTeacherPassword() {
  const input = document.getElementById("teacher-password-input");
  if (input.value !== TEACHER_PASSWORD) {
    setStatus("Incorrect password.", true);
    return;
  }
  leadMode = true;
  setStatus("", false);
  showView("classroomSelect");
}

document.getElementById("teacher-password-submit").addEventListener("click", submitTeacherPassword);
document.getElementById("teacher-password-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitTeacherPassword();
});

// ---- Classroom selection ----
// Hardcoded list (see classrooms.js) — just one entry today, but built as a
// list so adding more later is a one-line addition, not a UI rewrite. This
// screen is shared by both the student "Join a Classroom" flow and the
// teacher "Lead a Classroom" flow (branching on leadMode).

const classroomButtonsEl = document.getElementById("classroom-buttons");
for (const classroom of CLASSROOMS) {
  const button = document.createElement("button");
  button.textContent = classroom.label;
  button.addEventListener("click", () => {
    selectedClassroom = classroom;
    if (leadMode) {
      connectTeacherSpectator(classroom);
    } else {
      showView("connect");
    }
  });
  classroomButtonsEl.appendChild(button);
}

const graphPlane = new GraphPlane(document.getElementById("plane"));
graphPlane.start();

const teacherGraphPlane = new GraphPlane(document.getElementById("teacher-plane"));
teacherGraphPlane.start();

// Console/devtools debugging aid — window.__debug.getRoomClient().players,
// window.__debug.graphPlane.currentShooterSoldier, etc.
window.__debug = { graphPlane, getRoomClient: () => roomClient, teacherGraphPlane, getTeacherRoomClient: () => teacherRoomClient };

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

// ---- Skin selection (classroom waiting room) ----
// Dummy catalog for now (see skins.js) — cosmetic only, no real art. Choice
// persists per-browser (localStorage, no account system) and is broadcast
// to the room so other players see it too, same chat-piggyback trust model
// as everything else here.

const soldierSkinSelect = document.getElementById("soldier-skin-select");
const artillerySkinSelect = document.getElementById("artillery-skin-select");

for (const skin of SOLDIER_SKINS) {
  const option = document.createElement("option");
  option.value = skin.id;
  option.textContent = skin.label;
  soldierSkinSelect.appendChild(option);
}
for (const skin of ARTILLERY_SKINS) {
  const option = document.createElement("option");
  option.value = skin.id;
  option.textContent = skin.label;
  artillerySkinSelect.appendChild(option);
}

soldierSkinSelect.value = getSoldierSkin().id;
artillerySkinSelect.value = getArtillerySkin().id;

function reportCurrentSkin() {
  if (!roomClient || roomClient.localPlayerId === null) return;
  roomClient.reportSkin(roomClient.localPlayerId, getSoldierSkin().color, getArtillerySkin().color);
}

soldierSkinSelect.addEventListener("change", () => {
  setSoldierSkin(soldierSkinSelect.value);
  reportCurrentSkin();
});

artillerySkinSelect.addEventListener("change", () => {
  setArtillerySkin(artillerySkinSelect.value);
  reportCurrentSkin();
});

// ---- Leaderboard (classroom waiting room) ----
// Polls the bridge's stats tally (proxy/bridge.mjs) — the bridge, not any
// client, is the source of truth here, since kill/death/win detection is
// entirely client-side and self-reported (see stats.js); polling avoids
// needing every client to independently reconstruct the same tally.

function statsUrl(roomNum) {
  const httpBase = bridgeUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return `${httpBase}/stats/${roomNum}`;
}

function renderLeaderboard(data, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  const rows = Object.entries(data).sort(([, a], [, b]) => b.wins - a.wins || b.kills - a.kills);
  for (const [name, s] of rows) {
    const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
    const row = document.createElement("tr");
    row.innerHTML = `<td>${name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${kd}</td><td>${s.wins}</td>`;
    tbody.appendChild(row);
  }
}

// Shared by the student waiting-room leaderboard and the teacher view's —
// only one is ever polling at a time in a given browser tab (a session is
// always exactly one of public/classroom-student/classroom-teacher), so a
// single timer variable is fine.
function startLeaderboardPolling(roomNum, tbodyId) {
  stopLeaderboardPolling();

  const poll = async () => {
    try {
      const response = await fetch(statsUrl(roomNum));
      renderLeaderboard(await response.json(), tbodyId);
    } catch {
      // Bridge unreachable this tick — leaderboard just doesn't update, not fatal.
    }
  };

  poll();
  leaderboardTimer = setInterval(poll, 4000);
}

function stopLeaderboardPolling() {
  clearInterval(leaderboardTimer);
  leaderboardTimer = null;
}

// ---- Teacher spectator view ----
// A passive RoomClient that never calls .join() — confirmed the server
// broadcasts every message to every connected socket regardless of
// registration, so this renders the live match exactly like a real
// player's client would, just with no fire/ready/team controls, into its
// own GraphPlane/canvas (teacherGraphPlane/#teacher-plane) rather than the
// one real players use.
//
// One real risk: the server assigns room "leader" by connection order
// (oldest still-connected socket), NOT by who's actually a player — so if
// this spectator connects before any real student, it becomes leader, and
// the leader-driven auto-matchmaking (checkMatchmaking) would then
// silently never run for anyone: only the actual leader connection can
// use the SET_TEAM/ADD_SOLDIER/REMOVE_SOLDIER bypass, but a spectator has
// no player of its own to send the match-formed chat broadcast as
// (CHAT_MSG requires owning the playerId you send it for — no
// leader-bypass there). So if this connection ever becomes leader, it
// immediately disconnects and reconnects instead — a fresh connection
// joins the back of the server's connection list, handing leadership to
// whichever real player is still connected. Retries automatically if the
// teacher is still the only one connected.
let teacherConnectionAttempt = 0;

function connectTeacherSpectator(classroom) {
  disconnectTeacherSpectator();

  bridgeUrl = document.getElementById("bridge-url").value.trim(); // never visited connect-view, so capture it here instead
  document.getElementById("teacher-classroom-label").textContent = classroom.label;
  document.getElementById("teacher-game-status").textContent = "Waiting for the next game to start...";
  // GraphPlane's constructor always sets up a fake local sandbox match —
  // hide the canvas until a real one actually starts, so that doesn't
  // show through next to the "waiting" text.
  document.getElementById("teacher-plane").style.display = "none";
  showTeacherTab("game");

  teacherRoomClient = new RoomClient(bridgeUrl, classroom.roomNum);

  teacherRoomClient.onOpen = () => {
    showView("teacherView");
    startLeaderboardPolling(classroom.roomNum, "teacher-leaderboard-table-body");
    setStatus(`Watching ${classroom.label}.`, false);
  };
  teacherRoomClient.onClose = () => setStatus("Disconnected from classroom.", true);
  teacherRoomClient.onLeader = () => {
    if (teacherRoomClient.localPlayerId === null) {
      disconnectTeacherSpectator(); // bumps teacherConnectionAttempt — capture it as this reconnect's expected generation
      const expectedGeneration = teacherConnectionAttempt;
      setTimeout(() => {
        // Only proceed if nothing else (a manual "back", or another
        // reconnect) has disconnected/reconnected since this was scheduled.
        if (leadMode && teacherConnectionAttempt === expectedGeneration) connectTeacherSpectator(classroom);
      }, 2000);
    }
  };
  teacherRoomClient.onGameStart = () => {
    teacherGraphPlane.loadNetworkedMatch(teacherRoomClient);
    document.getElementById("teacher-game-status").textContent = "";
    document.getElementById("teacher-plane").style.display = "";
  };
  teacherRoomClient.onGameFinished = () => {
    document.getElementById("teacher-game-status").textContent = "Waiting for the next game to start...";
    document.getElementById("teacher-plane").style.display = "none";
  };
  teacherRoomClient.onFire = (shooterPlayer, shooterSoldier, functionString) => {
    const inverted = shooterPlayer.team === TEAM2;
    const result = teacherGraphPlane.playShot(
      shooterSoldier,
      functionString,
      teacherRoomClient.gameMode,
      shooterSoldier.angle,
      inverted,
    );
    if (!result.ok) console.error("teacher spectator playShot failed:", result.error);
  };
  teacherRoomClient.onTurnAdvance = (player) => {
    teacherGraphPlane.advanceTurn(player?.getCurrentTurnSoldier() ?? null);
  };

  teacherRoomClient.connect();
}

function disconnectTeacherSpectator() {
  teacherConnectionAttempt++; // invalidates any reconnect scheduled by a previous attempt
  teacherRoomClient?.disconnect();
  teacherRoomClient = null;
}

function showTeacherTab(tab) {
  document.getElementById("teacher-tab-game").classList.toggle("active", tab === "game");
  document.getElementById("teacher-tab-leaderboard").classList.toggle("active", tab === "leaderboard");
  document.getElementById("teacher-game-panel").style.display = tab === "game" ? "" : "none";
  document.getElementById("teacher-leaderboard-panel").style.display = tab === "leaderboard" ? "" : "none";
}

document.getElementById("teacher-tab-game").addEventListener("click", () => showTeacherTab("game"));
document.getElementById("teacher-tab-leaderboard").addEventListener("click", () => showTeacherTab("leaderboard"));

// ---- Auto-matchmaking (classroom waiting room, leader-orchestrated) ----
// Runs only on whichever client currently holds room leadership — the
// server guarantees exactly one at a time (the oldest still-connected
// connection), so this needs no separate election. See matchmaking.js for
// why the leader can assign teams/soldier counts for everyone but each
// player still has to ready themselves up.

// Repeatedly sending ADD_SOLDIER/REMOVE_SOLDIER based on the local
// (possibly stale) count on every single onPlayersChanged tick massively
// over/undershoots — each of the leader's own commands re-triggers this
// same event before its own echo has updated anything, so many redundant
// commands land in flight at once. Fix: only send one adjustment per
// distinct observed count per player, and wait for it to actually change
// (via a fresh echo) before sending another.
const soldierAdjustmentBaseline = new Map(); // id -> numSoldiers value when we last sent an adjustment for it

function normalizeSoldierCounts(playerIds, target) {
  for (const id of playerIds) {
    const player = roomClient.players.get(id);
    if (!player) continue;

    if (player.numSoldiers === target) {
      soldierAdjustmentBaseline.delete(id);
      continue;
    }
    if (soldierAdjustmentBaseline.get(id) === player.numSoldiers) continue; // already sent, still waiting for it to land

    soldierAdjustmentBaseline.set(id, player.numSoldiers);
    if (player.numSoldiers > target) roomClient.removeSoldier(id);
    else roomClient.addSoldier(id);
  }
}

function checkMatchmaking() {
  if (gameplayMode !== "classroom" || !roomClient?.isLeader) return;
  if (roomClient.gameState !== PRE_GAME) return;

  const currentIds = [...roomClient.players.keys()];
  matchQueue = matchQueue.filter((id) => currentIds.includes(id));
  for (const id of currentIds) {
    if (!matchQueue.includes(id)) matchQueue.push(id); // new arrivals join the back of the line
  }

  if (pendingMatch && !pendingMatch.ids.every((id) => roomClient.players.has(id))) {
    pendingMatch = null; // someone in the forming/announced match left — start over
  }

  if (!pendingMatch) {
    const match = selectMatch(matchQueue);
    if (!match) {
      // Fewer than 4 waiting — drive everyone present down to 0 soldiers
      // and let them self-ready as bystanders (see renderPlayerTable), so
      // nobody sitting idle ever blocks the server's all-ready gate for
      // whoever else eventually gets matched.
      normalizeSoldierCounts(currentIds, 0);
      return;
    }

    const matchedIds = [...match.team1, ...match.team2];
    for (const id of match.team1) roomClient.setTeam(id, TEAM1);
    for (const id of match.team2) roomClient.setTeam(id, TEAM2);
    pendingMatch = { ids: matchedIds, team1: match.team1, team2: match.team2, announced: false };
  }

  const bystanderIds = currentIds.filter((id) => !pendingMatch.ids.includes(id));
  normalizeSoldierCounts(pendingMatch.ids, 1);
  normalizeSoldierCounts(bystanderIds, 0);

  const settled =
    pendingMatch.ids.every((id) => roomClient.players.get(id)?.numSoldiers === 1) &&
    bystanderIds.every((id) => roomClient.players.get(id)?.numSoldiers === 0);

  // ADD_SOLDIER/REMOVE_SOLDIER reset EVERYONE's ready flag server-side
  // (setEveryoneNotReady() in GraphServer.java) — so broadcasting match-
  // formed (which triggers the 4 matched players' self-ready) is only
  // durable once NOTHING is still being adjusted for anyone in the room,
  // not just the 4 being matched. A late-arriving bystander needing its
  // own trim-to-0 would otherwise wipe an already-readied match right
  // out from under it. `announced` flips back to false whenever settled
  // goes false again, so a fresh announcement (idempotent — matched
  // players just self-ready again) follows the next time things settle.
  if (!settled) {
    pendingMatch.announced = false;
    return;
  }
  if (pendingMatch.announced) return;

  pendingMatch.announced = true;
  matchQueue = [...matchQueue.filter((id) => !pendingMatch.ids.includes(id)), ...pendingMatch.ids];
  roomClient.broadcastMatchFormed(roomClient.localPlayerId, { team1: pendingMatch.team1, team2: pendingMatch.team2 });
}

// ---- Synchronized countdown overlay ----
// Timed off the server's own START_COUNTDOWN broadcast (roomClient.js's
// onCountdown) rather than a separately-invented deadline — see
// SERVER_START_GAME_DELAY_MS in matchmaking.js for why that's the more
// robust choice: it's a real event every client already receives
// together, not a second clock that could skew from the first.

function showCountdown(durationMs, teammateName) {
  const overlay = document.getElementById("countdown-overlay");
  const numberEl = document.getElementById("countdown-number");
  document.getElementById("countdown-teammate").textContent = teammateName
    ? `You're playing with: ${teammateName}`
    : "Get ready!";
  overlay.classList.add("visible");

  const deadline = Date.now() + durationMs;

  function tick() {
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    numberEl.textContent = remaining > 0 ? String(remaining) : "GO!";
    countdownRaf = requestAnimationFrame(tick);
  }

  cancelAnimationFrame(countdownRaf);
  tick();
}

function hideCountdown() {
  document.getElementById("countdown-overlay").classList.remove("visible");
  cancelAnimationFrame(countdownRaf);
  countdownRaf = null;
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
  classroomSkinSent = false;
  pendingMatch = null;

  const isClassroom = gameplayMode === "classroom";
  document.getElementById("level-row").style.display = isClassroom ? "none" : "";
  document.getElementById("classroom-level-row").style.display = isClassroom ? "" : "none";
  if (isClassroom) document.getElementById("classroom-level-label").textContent = getLevel(CLASSROOM_LEVEL_ID).label;

  roomClient = new RoomClient(bridgeUrl, roomNum);
  roomClient.onOpen = () => {
    roomClient.join(name);
    refreshLevelUI(null); // reset from whatever the previous room's level was
    if (isClassroom) {
      showView("waiting");
      startLeaderboardPolling(roomNum, "leaderboard-table-body");
    } else {
      showView("pregame");
    }
    setStatus(`Joined ${room.name}.`, false);
  };
  roomClient.onClose = () => {
    stopLeaderboardPolling();
    setStatus("Disconnected from room.", true);
  };
  roomClient.onPlayersChanged = () => {
    renderPlayerTable();
    checkMatchmaking();
  };
  roomClient.onLevelChanged = refreshLevelUI;
  roomClient.onMatchFormed = handleMatchFormed;
  roomClient.onChat = (playerId, message) => appendChat(roomClient.players.get(playerId)?.name ?? "?", message);
  roomClient.onCountdown = () => {
    setStatus("Game starting soon...", false);
    if (isClassroom) {
      showCountdown(SERVER_START_GAME_DELAY_MS, myTeammateNameForCountdown);
      myTeammateNameForCountdown = null; // one-shot — cleared so a later generic countdown doesn't reuse a stale name
    }
  };
  roomClient.onLeader = () => checkMatchmaking(); // leadership can hand off mid-session — new leader picks up orchestration
  roomClient.onGameStart = startNetworkedMatch;
  roomClient.onGameFinished = () => {
    setStatus(isClassroom ? "Game finished — back to the waiting room." : "Game finished — back to pre-game.", false);
    hideCountdown();
    pendingMatch = null;
    if (isClassroom) {
      showView("waiting");
      checkMatchmaking();
    } else {
      showView("pregame");
    }
  };
  wireRoomToGraphPlane(roomClient);
  roomClient.connect();
}

// A matched player's own client is the only one that can ready itself up
// (SET_READY has no leader-bypass, unlike SET_TEAM/ADD_SOLDIER/
// REMOVE_SOLDIER) — every client gets this broadcast, but only the 4 named
// players act on it. The actual countdown display is triggered separately
// by the server's own START_COUNTDOWN once ready — this just records who
// my teammate is for that upcoming overlay to show.
function handleMatchFormed({ team1, team2 }) {
  const allIds = [...team1, ...team2];
  if (!allIds.includes(roomClient.localPlayerId)) return;

  roomClient.setReady(roomClient.localPlayerId, true);

  const myTeam = team1.includes(roomClient.localPlayerId) ? team1 : team2;
  const teammateId = myTeam.find((id) => id !== roomClient.localPlayerId);
  myTeammateNameForCountdown = roomClient.players.get(teammateId)?.name ?? "?";
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

  if (gameplayMode === "classroom") {
    // Classroom mode locks the level and reports the chosen skin once
    // localPlayerId becomes available (it isn't yet at the moment we
    // join; ADD_PLAYER's echo assigns it asynchronously). Team/soldier
    // count/ready are entirely auto-managed by checkMatchmaking()/
    // handleMatchFormed, not this manual public-mode flow — in
    // particular, skip the team-balance auto-unready check below, since
    // matchmaking already guarantees a balanced 2v2 before ever
    // triggering self-ready, and checking it here too risks a false
    // positive from the SET_TEAM/SET_READY echoes arriving out of order.
    if (!classroomLevelSent) {
      classroomLevelSent = true;
      roomClient.setLevel(roomClient.localPlayerId, CLASSROOM_LEVEL_ID);
    }
    if (!classroomSkinSent) {
      classroomSkinSent = true;
      reportCurrentSkin();
    }

    // The server's checkAllReady() requires EVERY player currently in the
    // room to be ready, not just the 4 actually playing — so a bystander
    // sitting at 0 soldiers (see checkMatchmaking) has to self-ready too,
    // or nobody else's match can ever start. Only the player's own client
    // can do this (SET_READY has no leader-bypass).
    //
    // Gated on someone ELSE actually having soldiers first: without that
    // check, a room with fewer than 4 people (nobody matched yet) would
    // have every bystander self-ready, trivially satisfying
    // checkAllReady() with nobody actually playing — the server would
    // start a real, empty game (gameState -> GAME) that can then never
    // finish, since nothing with zero soldiers in play ever fires the
    // game-over check, permanently blocking matchmaking for everyone who
    // joins afterward too.
    const someoneHasSoldiers = [...roomClient.players.values()].some((p) => p.numSoldiers > 0);

    if (localPlayer.numSoldiers === 0 && someoneHasSoldiers && !localPlayer.ready) {
      roomClient.setReady(roomClient.localPlayerId, true);
    } else if (localPlayer.numSoldiers === 0 && !someoneHasSoldiers && localPlayer.ready) {
      roomClient.setReady(roomClient.localPlayerId, false);
    }
    return;
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
  hideCountdown();

  // Classroom rooms can hold more than the 4 currently matched (extra
  // waiting players sit at 0 soldiers, see checkMatchmaking/
  // normalizeSoldierCounts) — gameState is room-wide, so START_GAME fires
  // for them too even though they're not part of this round. Keep them on
  // the waiting screen instead of dragging them into a match they have no
  // soldiers in.
  const localPlayer = roomClient.players.get(roomClient.localPlayerId);
  if (gameplayMode === "classroom" && (!localPlayer || localPlayer.numSoldiers < 1)) {
    showView("waiting");
    setStatus("A match is in progress — you'll join the next one.", false);
    return;
  }

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
  if (roomClient.checkGameFinished()) {
    // Snapshot the winner right here, before GAME_FINISHED resets
    // anything — that message carries no winner info of its own (see
    // getWinningTeam's comment in roomClient.js).
    if (gameplayMode === "classroom") {
      const winningTeam = roomClient.getWinningTeam();
      const localPlayer = roomClient.players.get(roomClient.localPlayerId);
      if (winningTeam !== null && localPlayer?.team === winningTeam) {
        roomClient.reportStat(roomClient.localPlayerId, StatEvent.WIN);
      }
    }
    roomClient.reportGameFinished();
  } else {
    roomClient.readyNextTurn();
  }
};

// Each player reports only events about themselves (their own death, a
// kill they personally scored) — never on someone else's behalf, so
// there's nothing to dedupe (see stats.js).
graphPlane.onSoldierDied = (victimSoldier, shooterSoldier) => {
  if (gameplayMode !== "classroom" || !roomClient) return;

  if (victimSoldier.ownerId === roomClient.localPlayerId) {
    roomClient.reportStat(roomClient.localPlayerId, StatEvent.DEATH);
  }
  if (shooterSoldier?.ownerId === roomClient.localPlayerId) {
    roomClient.reportStat(roomClient.localPlayerId, StatEvent.KILL);
  }
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
