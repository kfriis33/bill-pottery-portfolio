// Ported from the client side of the lobby protocol — see
// src/Graphwar/GlobalClient.java's handleMessage for the ground truth this
// was checked against (the server side, GlobalServer.java, shows what gets
// sent but not always the exact field count client code expects). Handles
// the lobby only — joining it, seeing who else is there, and seeing the
// room list. Picking a room hands off to RoomClient (roomClient.js), a
// separate connection.

import { Protocol, javaUrlDecode, javaUrlEncode } from "./netProtocol.js";
import { LineSocket } from "./lineSocket.js";

export class LobbyClient {
  constructor(bridgeUrl) {
    this.bridgeUrl = bridgeUrl;
    this.players = new Map(); // id -> name
    this.rooms = new Map(); // roomId -> {name, ip, port, gameMode, numPlayers}
    this.roomInvalid = false;

    this.onRoomsChanged = () => {};
    this.onPlayersChanged = () => {};
    this.onChat = () => {};
    this.onOpen = () => {};
    this.onClose = () => {};
  }

  // The lobby protocol's handshake is unusual: the very first line the
  // client sends is the player's raw display name, with no protocol code
  // prefix at all (see LobbyPlayer.java run()) — everything after that is
  // normal code-prefixed messages.
  connect(name) {
    this.socket = new LineSocket(`${this.bridgeUrl}/lobby`);

    this.socket.onOpen = () => {
      this.socket.send(name);
      this.onOpen();
    };

    this.socket.onLine = (line) => this._handleLine(line);
    this.socket.onClose = () => this.onClose();
  }

  sendChat(message) {
    this.socket.send(`${Protocol.SAY_CHAT}&${javaUrlEncode(message)}`);
  }

  _handleLine(line) {
    const fields = line.split("&");
    const code = Number(fields[0]);

    switch (code) {
      case Protocol.NO_INFO:
        break;

      case Protocol.JOIN: {
        if (fields.length !== 3) break;
        const [, name, id] = fields;
        this.players.set(Number(id), javaUrlDecode(name));
        this.onPlayersChanged(this.players);
        break;
      }

      case Protocol.SAY_CHAT: {
        if (fields.length !== 3) break;
        const [, playerId, message] = fields;
        this.onChat(Number(playerId), javaUrlDecode(message));
        break;
      }

      case Protocol.ROOM_STATUS: {
        if (fields.length !== 4) break;
        const [, roomId, gameMode, numPlayers] = fields;
        const room = this.rooms.get(Number(roomId));
        if (room) {
          room.gameMode = Number(gameMode);
          room.numPlayers = Number(numPlayers);
          this.onRoomsChanged(this.rooms);
        }
        break;
      }

      case Protocol.CREATE_ROOM: {
        if (fields.length !== 5) break;
        const [, name, id, ip, port] = fields;
        this.rooms.set(Number(id), {
          name: javaUrlDecode(name),
          ip: javaUrlDecode(ip),
          port: Number(port),
          gameMode: 0,
          numPlayers: 0,
        });
        this.onRoomsChanged(this.rooms);
        break;
      }

      case Protocol.LIST_PLAYERS: {
        if (fields.length < 2) break;
        const count = Number(fields[1]);
        this.players.clear();
        for (let i = 0; i < count; i++) {
          const name = fields[2 + i * 2];
          const id = fields[3 + i * 2];
          this.players.set(Number(id), javaUrlDecode(name));
        }
        this.onPlayersChanged(this.players);
        break;
      }

      case Protocol.LIST_ROOMS: {
        if (fields.length < 2) break;
        const count = Number(fields[1]);
        this.rooms.clear();
        for (let i = 0; i < count; i++) {
          const base = 2 + i * 6;
          const [name, id, ip, port, gameMode, numPlayers] = fields.slice(base, base + 6);
          this.rooms.set(Number(id), {
            name: javaUrlDecode(name),
            ip: javaUrlDecode(ip),
            port: Number(port),
            gameMode: Number(gameMode),
            numPlayers: Number(numPlayers),
          });
        }
        this.onRoomsChanged(this.rooms);
        break;
      }

      case Protocol.CLOSE_ROOM: {
        if (fields.length !== 2) break;
        this.rooms.delete(Number(fields[1]));
        this.onRoomsChanged(this.rooms);
        break;
      }

      case Protocol.ROOM_INVALID: {
        this.roomInvalid = true;
        break;
      }

      case Protocol.QUIT: {
        if (fields.length !== 2) break;
        this.players.delete(Number(fields[1]));
        this.onPlayersChanged(this.players);
        break;
      }

      default:
        break;
    }
  }

  disconnect() {
    this.socket?.close();
  }
}
