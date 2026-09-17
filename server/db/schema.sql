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

-- ===== Phone model recognition =====
CREATE TABLE IF NOT EXISTS phone_models (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  brand            VARCHAR(100) NOT NULL,
  model_name       VARCHAR(150) NOT NULL,
  min_capacity_gb  INT UNSIGNED NOT NULL,
  cover_image_path VARCHAR(500) NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME NULL,
  UNIQUE KEY uq_brand_model (brand, model_name)
);

-- ภาพอ้างอิงของแต่ละรุ่น (training images สำหรับทำ embedding index) — is_active = false เมื่อถูกลบ
-- แบบ soft (ไฟล์จริงถูกลบออกจาก disk ด้วยตอน DELETE, คอลัมน์นี้กันไว้เผื่อ audit)
-- embedded_at = NULL หมายถึงยังไม่เคยถูกประมวลผลเข้า index ของ ML-Service (รอกด "ประมวลผลใหม่")
CREATE TABLE IF NOT EXISTS phone_model_images (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  model_id     BIGINT UNSIGNED NOT NULL,
  image_path   VARCHAR(500) NOT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  embedded_at  DATETIME NULL,
  uploaded_by  BIGINT UNSIGNED NULL,
  uploaded_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (model_id) REFERENCES phone_models(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_model_active (model_id, is_active)
);

-- รอบการสแกน (1 ภาพต้นฉบับที่อัพมา อาจมีหลายเครื่องอยู่ในภาพเดียว)
CREATE TABLE IF NOT EXISTS scan_batches (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id               BIGINT UNSIGNED NOT NULL,
  source                ENUM('web','app') NOT NULL DEFAULT 'web',
  original_image_path   VARCHAR(500) NOT NULL,
  annotated_image_path  VARCHAR(500) NULL,
  device_count          INT UNSIGNED NOT NULL DEFAULT 0,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- รายการเครื่อง (bounding box) ที่ตรวจพบในแต่ละรอบสแกน
CREATE TABLE IF NOT EXISTS scan_items (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id          BIGINT UNSIGNED NOT NULL,
  bbox_x            INT UNSIGNED NOT NULL,
  bbox_y            INT UNSIGNED NOT NULL,
  bbox_w            INT UNSIGNED NOT NULL,
  bbox_h            INT UNSIGNED NOT NULL,
  crop_image_path   VARCHAR(500) NOT NULL,
  matched_model_id  BIGINT UNSIGNED NULL,
  confidence_score  DECIMAL(5,4) NULL,
  status            ENUM('auto_matched','user_confirmed','unidentified','pending_review') NOT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (batch_id) REFERENCES scan_batches(id),
  FOREIGN KEY (matched_model_id) REFERENCES phone_models(id),
  INDEX idx_batch (batch_id),
  INDEX idx_status (status)
);

-- คิวเครื่องที่ระบบ "ไม่มั่นใจ" / ยังไม่รู้จัก รอแอดมิน/ผู้ใช้ยืนยันรุ่น — พอ resolved แล้ว crop_image_path
-- ของ scan_item จะถูกก็อปปี้เข้า phone_model_images ของ resolved_model_id อัตโนมัติ (ระบบ "เรียนรู้"
-- เพิ่มขึ้นทุกครั้งที่มีการยืนยัน โดยไม่ต้อง retrain โมเดล — แค่ reindex ใหม่)
CREATE TABLE IF NOT EXISTS unidentified_queue (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scan_item_id       BIGINT UNSIGNED NOT NULL,
  candidate_model_ids JSON NULL COMMENT '[{modelId, score}] top candidates จาก ML-Service ตอนสแกน',
  extra_images       JSON NULL COMMENT 'path ของภาพเพิ่มเติมหลายมุมที่ผู้ใช้ถ่ายมาสำหรับเครื่องที่ไม่รู้จัก',
  resolved_model_id  BIGINT UNSIGNED NULL,
  status             ENUM('pending','resolved','new_model_created') NOT NULL DEFAULT 'pending',
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at        DATETIME NULL,
  resolved_by        BIGINT UNSIGNED NULL,
  FOREIGN KEY (scan_item_id) REFERENCES scan_items(id),
  FOREIGN KEY (resolved_model_id) REFERENCES phone_models(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id),
  INDEX idx_status (status)
);

-- log การแก้ไข/ยืนยันของแอดมิน (ใช้ปรับ threshold ภายหลัง)
CREATE TABLE IF NOT EXISTS review_logs (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  unidentified_queue_id BIGINT UNSIGNED NULL,
  admin_user_id         BIGINT UNSIGNED NOT NULL,
  action                VARCHAR(100) NOT NULL,
  note                  VARCHAR(500) NULL,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unidentified_queue_id) REFERENCES unidentified_queue(id),
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);

-- ===== Seed: permission catalogue + role defaults (ดู server/src/config/menuCatalog.js) =====
INSERT INTO permissions (perm_key, category, description) VALUES
  ('web.security.users.view',      'web:security', 'ดู: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.users.edit',      'web:security', 'แก้ไข: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.audit_logs.view', 'web:security', 'ดู: ประวัติการใช้งานระบบ'),
  ('web.phone.scan.view',          'web:phone',    'ดู: ตรวจสอบรุ่นโทรศัพท์'),
  ('web.phone.scan.edit',          'web:phone',    'แก้ไข: อัพโหลดภาพตรวจสอบ'),
  ('web.phone.models.view',        'web:phone',    'ดู: ข้อมูลรุ่นโทรศัพท์'),
  ('web.phone.models.edit',        'web:phone',    'แก้ไข: เพิ่ม/แก้ไข/ลบรุ่นและภาพอ้างอิง'),
  ('web.phone.queue.view',         'web:phone',    'ดู: คิวตรวจสอบ'),
  ('web.phone.queue.edit',         'web:phone',    'แก้ไข: ยืนยัน/ปฏิเสธ/มอบหมายรุ่นในคิวตรวจสอบ'),
  ('web.phone.history.view',       'web:phone',    'ดู: ประวัติการสแกน')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

INSERT INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN', 'web.security.users.view'),
  ('ADMIN', 'web.security.users.edit'),
  ('ADMIN', 'web.security.audit_logs.view'),
  ('ADMIN', 'web.phone.scan.view'),
  ('ADMIN', 'web.phone.scan.edit'),
  ('ADMIN', 'web.phone.models.view'),
  ('ADMIN', 'web.phone.models.edit'),
  ('ADMIN', 'web.phone.queue.view'),
  ('ADMIN', 'web.phone.queue.edit'),
  ('ADMIN', 'web.phone.history.view'),
  ('OPERATOR', 'web.phone.scan.view'),
  ('OPERATOR', 'web.phone.scan.edit'),
  ('OPERATOR', 'web.phone.history.view')
ON DUPLICATE KEY UPDATE role = VALUES(role);
