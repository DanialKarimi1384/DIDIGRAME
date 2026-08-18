-- این مایگریشن برای دیتابیس‌هایی که قبلاً نسخه اول رو دیپلوی کرده بودن لازمه
-- (اگه دیتابیس تازه‌ست و اولین باره schema.sql رو اجرا می‌کنی، نیازی به این فایل نیست چون از قبل داخل schema.sql هست)

ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';
ALTER TABLE chats ADD COLUMN username TEXT;
ALTER TABLE chats ADD COLUMN description TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS contacts (
  user_id TEXT NOT NULL,
  contact_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, contact_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_username_unique ON chats(username);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
