// Auto-matchmaking for classroom mode: 2v2, 1 soldier each, run entirely by
// whichever client currently holds room leadership (GraphServer.java
// guarantees exactly one at a time — the oldest still-connected
// connection — so this needs no separate election). The leader can apply
// SET_TEAM/ADD_SOLDIER/REMOVE_SOLDIER to any player (a "leader bypass" the
// unmodified server already has, confirmed by reading GraphServer.java),
// but SET_READY is always self-only, so the leader only ever announces the
// plan — every matched player's own client is the one that actually
// readies itself up (see onMatchFormed wiring in multiplayer.js).
//
// Same CHAT_MSG-piggyback trick as levels.js's LEVEL_SYNC_PREFIX, carrying
// a small JSON payload instead of a single value.
export const MATCH_SYNC_PREFIX = "@@MATCH@@:";

// The server (GraphServer.java's StartDelayer) already waits exactly this
// long after everyone in the room is ready before actually starting —
// Constants.START_GAME_DELAY = 5000, unmodifiable since we don't touch the
// Java server. Rather than invent a separate broadcast countdown deadline
// (which would just be a second, potentially-skewed clock), the big
// countdown overlay times itself off this known duration, triggered by the
// server's own START_COUNTDOWN broadcast (see roomClient.js's onCountdown)
// — a real synchronized event every client already receives together,
// not something built from scratch.
export const SERVER_START_GAME_DELAY_MS = 5000;

// `waitingIds` should be in matchmaking-priority order (oldest-waiting/
// least-recently-played first — see multiplayer.js's matchQueue, which
// rotates just-played players to the back for fairness) and already
// filtered to whoever is currently connected. Returns null if fewer than 4.
export function selectMatch(waitingIds) {
  if (waitingIds.length < 4) return null;

  const [a, b, c, d] = waitingIds;
  return { team1: [a, b], team2: [c, d] };
}
