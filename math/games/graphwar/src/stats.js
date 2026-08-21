// Kill/death/win tracking has nowhere authoritative to live — the Java
// server never determines hits or game outcomes (entirely client-side,
// same as everywhere else in this port), and the bridge was, until now, a
// pure byte pipe with no state of its own. So each event is self-reported
// by the one player it's about (never someone else on their behalf — no
// dedup needed) via the same CHAT_MSG-piggyback trick levels.js's
// LEVEL_SYNC_PREFIX already uses. The bridge (proxy/bridge.mjs) peeks at
// these specifically to tally a small leaderboard; this sentinel string
// must match the constant duplicated there exactly.
export const STATS_SYNC_PREFIX = "@@STATS@@:";

export const StatEvent = {
  KILL: "KILL",
  DEATH: "DEATH",
  WIN: "WIN",
};
