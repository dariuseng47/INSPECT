-- ============================================================
-- Auth / Security / User-Management schema (single-tenant)
-- รันไฟล์นี้กับ database ที่ตั้งชื่อไว้ใน server/.env (DB_NAME) เช่น:
--   mysql -u root -p pean_inspect < server/db/schema.sql
-- ============================================================

-- ===== Users & RBAC =====
CREATE TABLE IF NOT EXISTS users (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role                    ENUM('SUPERADMIN','ADMIN','OPERATOR') NOT NULL,
  managed_by              BIGINT UNSIGNED NULL COMMENT 'ผู้สร้างบัญชีนี้ — ใช้กำหนดว่า admin คนไหนจัดการ operator คนไหนได้',
  username                VARCHAR(100) NOT NULL UNIQUE,
  password_hash           VARCHAR(255) NOT NULL,
  pin_hash                CHAR(64) NULL UNIQUE, -- HMAC-SHA256(pin, PIN_PEPPER) — login PIN 6 หลักจาก handheld
  full_name               VARCHAR(150) NOT NULL,
  phone                   VARCHAR(30),
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  perm_version            INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'เพิ่มทุกครั้งที่สิทธิ์ของ user นี้เปลี่ยน — ใช้เช็ค token เก่าค้าง',
  handheld_enabled        TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'บัญชีนี้ล็อกอินเครื่องพกพา (handheld) ได้ไหม — superadmin ข้ามเช็คนี้เสมอ',
  can_manage_subordinates TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'แอดมินคนนี้สร้าง/จัดการ operator ใต้ตัวเองได้ไหม',
  last_login_at           DATETIME NULL,
  last_login_client       ENUM('web','mobile') NULL,
  created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME NULL,
  FOREIGN KEY (managed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  token_hash    VARCHAR(255) NOT NULL,
  expires_at    DATETIME NOT NULL,
  revoked_at    DATETIME NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_token_hash (token_hash)
);

CREATE TABLE IF NOT EXISTS permissions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  perm_key      VARCHAR(100) NOT NULL UNIQUE,
  category      VARCHAR(100) NOT NULL,
  description   VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS role_default_permissions (
  role          ENUM('ADMIN','OPERATOR') NOT NULL,
  perm_key      VARCHAR(100) NOT NULL,
  PRIMARY KEY (role, perm_key)
);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT UNSIGNED NOT NULL,
  perm_key          VARCHAR(100) NOT NULL,
  effect            ENUM('GRANT','DENY') NOT NULL,
  granted_by        BIGINT UNSIGNED NOT NULL,
  superadmin_locked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = override นี้ตั้งโดย superadmin — admin แก้/ลบทับไม่ได้',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY uq_user_perm (user_id, perm_key)
);

-- ===== Login popup images (ภาพประกาศหลัง login จัดการโดย superadmin) =====
CREATE TABLE IF NOT EXISTS login_popup_images (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_url   VARCHAR(500) NOT NULL,
  roles       JSON NOT NULL COMMENT 'JSON array ของ role ที่เห็นรูปนี้ เช่น ["SUPERADMIN","ADMIN"]',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  BIGINT UNSIGNED NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ===== Audit (append-only — ห้าม UPDATE/DELETE จาก app user, ดู db/init_security.sql) =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  action        VARCHAR(150) NOT NULL,
  entity_type   VARCHAR(100) NOT NULL,
  entity_id     BIGINT UNSIGNED NULL,
  metadata      JSON,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ===== Seed: permission catalogue + role defaults (ดู server/src/config/menuCatalog.js) =====
INSERT INTO permissions (perm_key, category, description) VALUES
  ('web.security.users.view',      'web:security', 'ดู: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.users.edit',      'web:security', 'แก้ไข: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.audit_logs.view', 'web:security', 'ดู: ประวัติการใช้งานระบบ')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

INSERT INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN', 'web.security.users.view'),
  ('ADMIN', 'web.security.users.edit'),
  ('ADMIN', 'web.security.audit_logs.view')
ON DUPLICATE KEY UPDATE role = VALUES(role);
