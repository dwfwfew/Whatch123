export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room') || 'default';
      const id = env.ROOM_DO.idFromName(roomId);
      const stub = env.ROOM_DO.get(id);
      return stub.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};

export class RoomDO {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.state.acceptWebSocket(server);
    this.sessions.push(server);

    // اگر نفر دوم وارد شد، به میزبان اطلاع می‌دهیم
    if (this.sessions.length === 2) {
      this.broadcast({ type: 'peer-joined' }, server);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      // ارسال پیام به نفر مقابل در اتاق
      for (const session of this.sessions) {
        if (session !== ws) {
          session.send(JSON.stringify(data));
        }
      }
    } catch (e) {}
  }

  webSocketClose(ws, code, reason, wasClean) {
    this.sessions = this.sessions.filter(s => s !== ws);
  }

  webSocketError(ws, error) {
    this.sessions = this.sessions.filter(s => s !== ws);
  }
}
