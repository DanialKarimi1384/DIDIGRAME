import { uid } from "./utils.js";

// یک نمونه از این Durable Object به ازای هر chatId ساخته می‌شود
// و مسئول نگه‌داشتن سوکت‌های آنلاین + پخش آنی پیام‌های آن چت است.
export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> { userId, username }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/connect")) {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const userId = url.searchParams.get("userId");
      const username = url.searchParams.get("username");
      const chatId = url.searchParams.get("chatId");

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      this.sessions.set(server, { userId, username, chatId });

      server.addEventListener("message", async (event) => {
        await this.handleMessage(server, event.data);
      });

      const closeOrError = () => this.sessions.delete(server);
      server.addEventListener("close", closeOrError);
      server.addEventListener("error", closeOrError);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleMessage(sender, raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (data.type !== "message") return;

    const senderInfo = this.sessions.get(sender);
    if (!senderInfo) return;

    const content = String(data.content || "").trim().slice(0, 4000);
    if (!content) return;

    const messageId = uid();
    const createdAt = Date.now();

    // ذخیره پایدار در D1
    await this.env.DB.prepare(
      "INSERT INTO messages (id, chat_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(messageId, senderInfo.chatId, senderInfo.userId, content, createdAt)
      .run();

    const payload = JSON.stringify({
      type: "message",
      message: {
        id: messageId,
        chatId: senderInfo.chatId,
        senderId: senderInfo.userId,
        senderUsername: senderInfo.username,
        content,
        createdAt,
      },
    });

    // پخش برای همه‌ی کلاینت‌های متصل به این چت
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(payload);
      } catch {
        this.sessions.delete(ws);
      }
    }
  }
}
