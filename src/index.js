import { register, login, logout, me } from "./auth.js";
import { json, err, uid, getUserFromRequest } from "./utils.js";
export { ChatRoom } from "./chatroom.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      // ---- Auth ----
      if (pathname === "/api/register" && request.method === "POST") return register(request, env);
      if (pathname === "/api/login" && request.method === "POST") return login(request, env);
      if (pathname === "/api/logout" && request.method === "POST") return logout(request, env);
      if (pathname === "/api/me" && request.method === "GET") return me(request, env);

      // ---- Search users ----
      if (pathname === "/api/users/search" && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const q = (url.searchParams.get("q") || "").trim();
        if (q.length < 1) return json({ users: [] });
        const rows = await env.DB.prepare(
          "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 20"
        )
          .bind(`%${q}%`, user.id)
          .all();
        return json({ users: rows.results });
      }

      // ---- List my chats ----
      if (pathname === "/api/chats" && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;

        const rows = await env.DB.prepare(
          `SELECT c.id, c.type, c.name,
                  (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                  (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_at
           FROM chats c
           JOIN chat_members m ON m.chat_id = c.id
           WHERE m.user_id = ?
           ORDER BY last_at DESC`
        )
          .bind(user.id)
          .all();

        const chats = [];
        for (const chat of rows.results) {
          let displayName = chat.name;
          if (chat.type === "direct") {
            const other = await env.DB.prepare(
              `SELECT u.username FROM chat_members m JOIN users u ON u.id = m.user_id
               WHERE m.chat_id = ? AND m.user_id != ?`
            )
              .bind(chat.id, user.id)
              .first();
            displayName = other ? other.username : "کاربر حذف‌شده";
          }
          chats.push({
            id: chat.id,
            type: chat.type,
            name: displayName,
            lastMessage: chat.last_message,
            lastAt: chat.last_at,
          });
        }
        return json({ chats });
      }

      // ---- Create/get direct chat with another user ----
      if (pathname === "/api/chats/direct" && request.method === "POST") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const body = await request.json().catch(() => null);
        if (!body || !body.username) return err("نام کاربری الزامی است");

        const target = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
          .bind(body.username)
          .first();
        if (!target) return err("کاربری با این نام پیدا نشد", 404);
        if (target.id === user.id) return err("نمی‌توانید با خودتان چت بزنید");

        // آیا چت پرسنال از قبل وجود دارد؟
        const existing = await env.DB.prepare(
          `SELECT c.id FROM chats c
           JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
           JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
           WHERE c.type = 'direct'`
        )
          .bind(user.id, target.id)
          .first();

        if (existing) return json({ chatId: existing.id, name: target.username });

        const chatId = uid();
        const now = Date.now();
        await env.DB.prepare(
          "INSERT INTO chats (id, type, name, created_by, created_at) VALUES (?, 'direct', NULL, ?, ?)"
        )
          .bind(chatId, user.id, now)
          .run();
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
          ).bind(chatId, user.id, now),
          env.DB.prepare(
            "INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
          ).bind(chatId, target.id, now),
        ]);

        return json({ chatId, name: target.username });
      }

      // ---- Create group chat ----
      if (pathname === "/api/chats/group" && request.method === "POST") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const body = await request.json().catch(() => null);
        const name = (body && String(body.name || "").trim()) || "";
        const usernames = (body && Array.isArray(body.members) ? body.members : []).filter(Boolean);

        if (!name) return err("نام گروه الزامی است");

        const chatId = uid();
        const now = Date.now();
        await env.DB.prepare(
          "INSERT INTO chats (id, type, name, created_by, created_at) VALUES (?, 'group', ?, ?, ?)"
        )
          .bind(chatId, name, user.id, now)
          .run();

        const inserts = [
          env.DB.prepare(
            "INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
          ).bind(chatId, user.id, now),
        ];

        for (const uname of usernames) {
          const member = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
            .bind(uname)
            .first();
          if (member && member.id !== user.id) {
            inserts.push(
              env.DB.prepare(
                "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
              ).bind(chatId, member.id, now)
            );
          }
        }
        await env.DB.batch(inserts);

        return json({ chatId, name });
      }

      // ---- Message history for a chat ----
      const historyMatch = pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
      if (historyMatch && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const chatId = historyMatch[1];

        const member = await env.DB.prepare(
          "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?"
        )
          .bind(chatId, user.id)
          .first();
        if (!member) return err("عضو این چت نیستید", 403);

        const rows = await env.DB.prepare(
          `SELECT m.id, m.chat_id, m.sender_id, u.username as sender_username, m.content, m.created_at
           FROM messages m JOIN users u ON u.id = m.sender_id
           WHERE m.chat_id = ? ORDER BY m.created_at ASC LIMIT 200`
        )
          .bind(chatId)
          .all();

        return json({ messages: rows.results });
      }

      // ---- WebSocket upgrade: routed to the Durable Object for this chat ----
      const wsMatch = pathname.match(/^\/ws\/([^/]+)$/);
      if (wsMatch) {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const chatId = wsMatch[1];

        const member = await env.DB.prepare(
          "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?"
        )
          .bind(chatId, user.id)
          .first();
        if (!member) return err("عضو این چت نیستید", 403);

        const id = env.CHAT_ROOM.idFromName(chatId);
        const stub = env.CHAT_ROOM.get(id);

        const forwardUrl = new URL(request.url);
        forwardUrl.pathname = "/connect";
        forwardUrl.searchParams.set("userId", user.id);
        forwardUrl.searchParams.set("username", user.username);
        forwardUrl.searchParams.set("chatId", chatId);

        return stub.fetch(forwardUrl.toString(), request);
      }

      // ---- Static frontend ----
      return env.ASSETS.fetch(request);
    } catch (e) {
      return err("خطای داخلی سرور: " + (e && e.message ? e.message : String(e)), 500);
    }
  },
};

async function requireAuth(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return err("احراز هویت نشده", 401);
  return user;
}
