import { register, login, logout, me } from "./auth.js";
import { json, err, uid, getUserFromRequest, isValidHandle, isHandleTaken } from "./utils.js";
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

      // ---- Public profile of a user by @handle ----
      const userProfileMatch = pathname.match(/^\/api\/users\/by-username\/([^/]+)$/);
      if (userProfileMatch && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const target = await env.DB.prepare(
          "SELECT id, username, bio, created_at FROM users WHERE username = ?"
        )
          .bind(userProfileMatch[1])
          .first();
        if (!target) return err("کاربری با این آیدی پیدا نشد", 404);
        return json({
          type: "user",
          id: target.id,
          username: target.username,
          bio: target.bio,
          isMe: target.id === user.id,
        });
      }

      // ---- Public profile of a group/channel by @handle ----
      const chatProfileMatch = pathname.match(/^\/api\/chats\/by-username\/([^/]+)$/);
      if (chatProfileMatch && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const chat = await env.DB.prepare(
          "SELECT id, type, name, username, description, created_by FROM chats WHERE username = ?"
        )
          .bind(chatProfileMatch[1])
          .first();
        if (!chat) return err("گروه یا کانالی با این آیدی پیدا نشد", 404);

        const memberCountRow = await env.DB.prepare(
          "SELECT COUNT(*) as c FROM chat_members WHERE chat_id = ?"
        )
          .bind(chat.id)
          .first();
        const membership = await env.DB.prepare(
          "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?"
        )
          .bind(chat.id, user.id)
          .first();

        return json({
          type: chat.type,
          id: chat.id,
          name: chat.name,
          username: chat.username,
          description: chat.description,
          memberCount: memberCountRow ? memberCountRow.c : 0,
          isMember: !!membership,
          isOwner: membership && membership.role === "owner",
        });
      }

      // ---- List my chats ----
      if (pathname === "/api/chats" && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;

        const rows = await env.DB.prepare(
          `SELECT c.id, c.type, c.name, c.username,
                  (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                  (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_at
           FROM chats c
           JOIN chat_members m ON m.chat_id = c.id
           WHERE m.user_id = ? AND c.type != 'saved'
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
            username: chat.username,
            lastMessage: chat.last_message,
            lastAt: chat.last_at,
          });
        }
        return json({ chats });
      }

      // ---- Get or create my "Saved Messages" chat ----
      if (pathname === "/api/chats/saved" && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;

        let saved = await env.DB.prepare(
          `SELECT c.id FROM chats c JOIN chat_members m ON m.chat_id = c.id
           WHERE c.type = 'saved' AND m.user_id = ?`
        )
          .bind(user.id)
          .first();

        if (!saved) {
          const chatId = uid();
          const now = Date.now();
          await env.DB.batch([
            env.DB.prepare(
              "INSERT INTO chats (id, type, name, created_by, created_at) VALUES (?, 'saved', 'پیام‌های ذخیره‌شده', ?, ?)"
            ).bind(chatId, user.id, now),
            env.DB.prepare(
              "INSERT INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
            ).bind(chatId, user.id, now),
          ]);
          saved = { id: chatId };
        }

        return json({ chatId: saved.id, name: "پیام‌های ذخیره‌شده" });
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
        return createGroupOrChannel(request, env, "group");
      }

      // ---- Create channel ----
      if (pathname === "/api/chats/channel" && request.method === "POST") {
        return createGroupOrChannel(request, env, "channel");
      }

      // ---- Add members to an existing group/channel ----
      const membersMatch = pathname.match(/^\/api\/chats\/([^/]+)\/members$/);
      if (membersMatch && request.method === "POST") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const chatId = membersMatch[1];

        const chat = await env.DB.prepare("SELECT id, type, created_by FROM chats WHERE id = ?")
          .bind(chatId)
          .first();
        if (!chat) return err("چت پیدا نشد", 404);
        if (chat.type !== "group" && chat.type !== "channel") {
          return err("فقط می‌توانید به گروه یا کانال عضو اضافه کنید");
        }

        const membership = await env.DB.prepare(
          "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?"
        )
          .bind(chatId, user.id)
          .first();
        if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
          return err("فقط مدیر می‌تواند عضو اضافه کند", 403);
        }

        const body = await request.json().catch(() => null);
        const usernames = (body && Array.isArray(body.members) ? body.members : []).filter(Boolean);
        if (usernames.length === 0) return err("حداقل یک نام کاربری وارد کنید");

        const now = Date.now();
        const inserts = [];
        const added = [];
        for (const uname of usernames) {
          const member = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
            .bind(uname)
            .first();
          if (member) {
            inserts.push(
              env.DB.prepare(
                "INSERT OR IGNORE INTO chat_members (chat_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
              ).bind(chatId, member.id, now)
            );
            added.push(member.username);
          }
        }
        if (inserts.length > 0) await env.DB.batch(inserts);

        return json({ added });
      }

      // ---- Contacts ----
      if (pathname === "/api/contacts" && request.method === "GET") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const rows = await env.DB.prepare(
          `SELECT u.id, u.username FROM contacts c JOIN users u ON u.id = c.contact_user_id
           WHERE c.user_id = ? ORDER BY u.username ASC`
        )
          .bind(user.id)
          .all();
        return json({ contacts: rows.results });
      }

      if (pathname === "/api/contacts" && request.method === "POST") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const body = await request.json().catch(() => null);
        if (!body || !body.username) return err("نام کاربری الزامی است");

        const target = await env.DB.prepare("SELECT id, username FROM users WHERE username = ?")
          .bind(body.username)
          .first();
        if (!target) return err("کاربری با این نام پیدا نشد", 404);
        if (target.id === user.id) return err("نمی‌توانید خودتان را اضافه کنید");

        await env.DB.prepare(
          "INSERT OR IGNORE INTO contacts (user_id, contact_user_id, created_at) VALUES (?, ?, ?)"
        )
          .bind(user.id, target.id, Date.now())
          .run();

        return json({ ok: true, contact: { id: target.id, username: target.username } });
      }

      const contactDeleteMatch = pathname.match(/^\/api\/contacts\/([^/]+)$/);
      if (contactDeleteMatch && request.method === "DELETE") {
        const user = await requireAuth(request, env);
        if (user instanceof Response) return user;
        const target = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
          .bind(contactDeleteMatch[1])
          .first();
        if (target) {
          await env.DB.prepare("DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?")
            .bind(user.id, target.id)
            .run();
        }
        return json({ ok: true });
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

      // ---- Static frontend (client-side router handles /u/:id and /c/:id deep links) ----
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status === 404 && request.method === "GET") {
        // مسیرهایی مثل /u/username یا /c/groupname فایل فیزیکی نیستن؛
        // index.html رو برمی‌گردونیم تا روتر سمت کلاینت مسیر رو هندل کنه
        const indexUrl = new URL("/index.html", url.origin);
        return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
      }
      return assetResponse;
    } catch (e) {
      return err("خطای داخلی سرور: " + (e && e.message ? e.message : String(e)), 500);
    }

    async function createGroupOrChannel(request, env, kind) {
      const user = await requireAuth(request, env);
      if (user instanceof Response) return user;
      const body = await request.json().catch(() => null);
      const name = (body && String(body.name || "").trim()) || "";
      const handle = (body && String(body.username || "").trim()) || "";
      const description = (body && String(body.description || "").trim()) || "";
      const usernames = (body && Array.isArray(body.members) ? body.members : []).filter(Boolean);

      if (!name) return err(kind === "channel" ? "نام کانال الزامی است" : "نام گروه الزامی است");
      if (!handle || !isValidHandle(handle)) {
        return err("آیدی باید بین ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد و آندرلاین باشد");
      }
      if (await isHandleTaken(env, handle)) {
        return err("این آیدی قبلاً استفاده شده", 409);
      }

      const chatId = uid();
      const now = Date.now();
      await env.DB.prepare(
        "INSERT INTO chats (id, type, name, username, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(chatId, kind, name, handle, description, user.id, now)
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

      return json({ chatId, name, username: handle });
    }

    async function requireAuth(request, env) {
      const user = await getUserFromRequest(request, env);
      if (!user) return err("احراز هویت نشده", 401);
      return user;
    }
  },
};
