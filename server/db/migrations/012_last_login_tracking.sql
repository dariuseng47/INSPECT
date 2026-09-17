-- ให้ dashboard ดูได้ว่าล่าสุดใคร login จากมือถือ (handheld) เมื่อไหร่ — ดู
-- server/src/controllers/auth.controller.js#login (เขียนคอลัมน์นี้) และ
-- server/src/controllers/users.controller.js#listUsers (ส่งกลับพร้อม isOnline แบบ real-time
-- จาก server/src/sockets/presence.js ซึ่งเป็น in-memory ไม่ได้เก็บ DB)
ALTER TABLE users
  ADD COLUMN last_login_at DATETIME NULL AFTER is_active,
  ADD COLUMN last_login_client VARCHAR(20) NULL AFTER last_login_at;
