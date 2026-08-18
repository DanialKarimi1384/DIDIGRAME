-- کاربران (username همون آیدی یونیک قابل جستجو با @ هست)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

-- سشن‌های لاگین (توکن ساده)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- چت‌ها: پرسنال / گروه / کانال / سیو مسیج
-- username: آیدی یونیک قابل جستجو و لینک‌دهی برای گروه و کانال (مثل کاربرها)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'direct' | 'group' | 'channel' | 'saved'
  name TEXT,
  username TEXT UNIQUE,
  description TEXT DEFAULT '',
  created_by TEXT,
  created_at INTEGER NOT NULL
);

-- اعضای هر چت (گروه/کانال/پرسنال/سیو مسیج)
CREATE TABLE IF NOT EXISTS chat_members (
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- پیام‌ها
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- دفتر مخاطبین هر کاربر
CREATE TABLE IF NOT EXISTS contacts (
  user_id TEXT NOT NULL,
  contact_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, contact_user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_username ON chats(username);
