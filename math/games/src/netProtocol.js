// Ported from src/GraphServer/NetworkProtocol.java — the message type codes
// shared by the lobby (GlobalServer) and room (GraphServer) protocols.

export const Protocol = {
  NO_INFO: 10,
  ALL_INFO: 11,
  SET_NAME: 12, // defined in the original but never actually used anywhere
  CHANGE_MODE: 13,
  CHAT_MSG: 14,
  CLOSE_CONNECTION: 15,
  ADD_PLAYER: 16,
  ADD_SOLDIER: 17,
  SET_SOLDIER: 18,
  REMOVE_SOLDIER: 19,
  SET_TEAM: 20,
  SET_READY: 21,
  START_GAME: 22,
  CHANGE_GAME_TYPE: 23,
  FIRE_FUNC: 24,
  NEXT_TURN: 25,
  SEND_FUNC: 26,
  READY_NEXT_TURN: 27,
  SET_ANGLE: 28,
  REMOVE_PLAYER: 29,
  END_GAME: 30,
  NEXT_MODE: 31,
  PREVIOUS_MODE: 32,
  SET_MODE: 33,
  CHANGE_ANGLE: 34,
  KILL_PLAYER: 35,
  CONNECTION_ACCEPTED: 36,
  TIME_UP: 37,
  GAME_FULL: 38,
  DISCONNECT: 39,
  GAME_FINISHED: 40,
  NEW_LEADER: 41,
  START_COUNTDOWN: 42,
  REORDER: 43,
  FUNCTION_PREVIEW: 44,

  JOIN: 101,
  SAY_CHAT: 102,
  LIST_PLAYERS: 103,
  LIST_ROOMS: 104,
  ROOM_STATUS: 105,
  QUIT: 106,
  CLOSE_ROOM: 107,
  CREATE_ROOM: 108,
  ROOM_INVALID: 109,
};

// Java's URLEncoder/URLDecoder implement application/x-www-form-urlencoded
// (space <-> '+'), not the RFC 3986 scheme JS's encodeURIComponent/
// decodeURIComponent use. Mismatching these silently corrupts any field with
// a space — e.g. the room name "Public Room 0" arrives over the wire as
// "Public+Room+0" (confirmed against the real GlobalServer), which
// decodeURIComponent would leave as a literal "Public+Room+0" instead of
// decoding the '+' back to a space. URLSearchParams implements the same
// x-www-form-urlencoded scheme Java uses, so it round-trips correctly.
export function javaUrlEncode(value) {
  return new URLSearchParams({ v: value }).toString().slice(2);
}

export function javaUrlDecode(value) {
  return new URLSearchParams(`v=${value}`).get("v");
}

export function buildMessage(code, ...fields) {
  return [code, ...fields].join("&");
}

export function parseMessage(line) {
  const fields = line.split("&");
  return { code: Number(fields[0]), fields };
}
