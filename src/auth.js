import { json, err, uid, hashPassword, genSalt, genToken, getUserFromRequest } from "./utils.js";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 روز

export async function register(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password) {
    return err("نام کاربری و رمز عبور الزامی است");
  }
  const username = String(body.username).trim();
  const password = String(body.password);

  if (username.length < 3 || username.length > 32) {
    return err("نام کاربری باید بین ۳ تا ۳۲ کاراکتر باشد");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return err("نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد و آندرلاین باشد");
  }
  if (password.length < 6) {
    return err("رمز عبور باید حداقل ۶ کاراکتر باشد");
  }

  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
    .bind(username)
    .first();
  if (existing) return err("این نام کاربری قبلاً گرفته شده", 409);

  const salt = genSalt();
  const passwordHash = await hashPassword(password, salt);
  const userId = uid();
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(userId, username, passwordHash, salt, now)
    .run();

  const token = genToken();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, userId, now, now + SESSION_DURATION_MS)
    .run();

  return json({ token, user: { id: userId, username } });
}

export async function login(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !body.username || !body.password) {
    return err("نام کاربری و رمز عبور الزامی است");
  }
  const username = String(body.username).trim();
  const password = String(body.password);

  const user = await env.DB.prepare(
    "SELECT id, username, password_hash, salt FROM users WHERE username = ?"
  )
    .bind(username)
    .first();

  if (!user) return err("نام کاربری یا رمز عبور اشتباه است", 401);

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.password_hash) {
    return err("نام کاربری یا رمز عبور اشتباه است", 401);
  }

  const token = genToken();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(token, user.id, now, now + SESSION_DURATION_MS)
    .run();

  return json({ token, user: { id: user.id, username: user.username } });
}

export async function logout(request, env) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  const authHeader = request.headers.get("Authorization") || "";
  if (!token && authHeader.startsWith("Bearer ")) token = authHeader.slice(7);
  if (token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  }
  return json({ ok: true });
}

export async function me(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) return err("احراز هویت نشده", 401);
  return json({ user });
}
