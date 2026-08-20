// Thin line-buffered wrapper around a WebSocket connection to the ws-tcp
// bridge (see proxy/bridge.mjs). Mirrors GraphServer/Connection.java's
// PrintWriter/BufferedReader framing: the wire protocol is plain
// newline-terminated text, and a single WS message frame from the bridge is
// just whatever chunk of bytes the OS handed the TCP socket — it can contain
// multiple protocol messages, or a partial one, so messages must be split on
// '\n' from a persistent buffer rather than trusting one frame == one message.
//
// Also mirrors the real client's keepalive behavior (see
// checkStayAliveTime()/sendKeepAlive() in ServerConnection.java and
// GlobalClient.java): the server drops a connection it hasn't heard from in
// TIMEOUT_DROP (originally 30s upstream; bumped to 5 minutes on this fork's
// server — see graphwar/src/GraphServer/Constants.java), so a client that
// only ever sends in response to user actions gets disconnected the moment a
// player sits idle on a screen for that long. Sending NO_INFO whenever idle
// for TIMEOUT_KEEPALIVE (5s) keeps the connection alive with no user action
// required, and is cheap enough to leave in regardless of the drop timeout.

import { Protocol } from "./netProtocol.js";
import { TIMEOUT_KEEPALIVE } from "./constants.js";

export class LineSocket {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this._buffer = "";
    this._decoder = new TextDecoder("utf-8");
    this._lastSentTime = performance.now();

    this.onOpen = () => {};
    this.onLine = () => {};
    this.onClose = () => {};
    this.onError = () => {};

    this.ws.addEventListener("open", () => {
      this._keepaliveInterval = setInterval(() => this._sendKeepaliveIfIdle(), TIMEOUT_KEEPALIVE / 2);
      this.onOpen();
    });
    this.ws.addEventListener("close", () => {
      clearInterval(this._keepaliveInterval);
      this.onClose();
    });
    this.ws.addEventListener("error", (event) => this.onError(event));
    this.ws.addEventListener("message", (event) => this._handleData(event.data));
  }

  _sendKeepaliveIfIdle() {
    if (performance.now() - this._lastSentTime >= TIMEOUT_KEEPALIVE) {
      this.send(`${Protocol.NO_INFO}`);
    }
  }

  _handleData(data) {
    const text = typeof data === "string" ? data : this._decoder.decode(data);
    this._buffer += text;

    let newlineIndex;
    while ((newlineIndex = this._buffer.indexOf("\n")) !== -1) {
      const line = this._buffer.slice(0, newlineIndex).replace(/\r$/, "");
      this._buffer = this._buffer.slice(newlineIndex + 1);
      this.onLine(line);
    }
  }

  send(line) {
    this.ws.send(`${line}\n`);
    this._lastSentTime = performance.now();
  }

  close() {
    clearInterval(this._keepaliveInterval);
    this.ws.close();
  }
}
