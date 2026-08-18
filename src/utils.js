// ابزارهای کمکی مشترک

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function err(message, status = 400) {
  return json({ error: message }, status);
}

export function uid() {
  return crypto.randomUUID();
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// هش کردن پسورد با PBKDF2 (بدون نیاز به کتابخانه خارجی، native در Workers)
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

export function genSalt() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export function genToken() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(32)));
}

// اعتبارسنجی آیدی یونیک (برای کاربر، گروه یا کانال) — قابل جستجو با @
export function isValidHandle(str) {
  return typeof str === "string" && /^[a-zA-Z0-9_]{3,32}$/.test(str);
}

// بررسی اینکه یک هندل (username) نه بین کاربرها و نه بین چت‌ها تکراری نباشد
export async function isHandleTaken(env, handle, excludeChatId = null) {
  const userRow = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(handle)
    .first();
  if (userRow) return true;

  const chatRow = excludeChatId
    ? await env.DB.prepare("SELECT id FROM chats WHERE username = ? AND id != ?")
        .bind(handle, excludeChatId)
        .first()
    : await env.DB.prepare("SELECT id FROM chats WHERE username = ?").bind(handle).first();
  return !!chatRow;
}

// استخراج و اعتبارسنجی کاربر از روی توکن (هدر Authorization یا کوئری‌پارام token)
export async function getUserFromRequest(request, env) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  if (!token) {
    const authHeader = request.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7);
  }
  if (!token) return null;

  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT sessions.user_id as user_id, users.username as username FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ? AND expires_at > ?"
  )
    .bind(token, now)
    .first();

  if (!row) return null;
  return { id: row.user_id, username: row.username };
}
