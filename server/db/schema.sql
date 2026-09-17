-- ============================================================
-- LMS Database Schema — รวมจาก docs/data-model.md, docs/rbac-permissions.md,
-- docs/offline-sync-conflict-resolution.md, docs/device-network-failure-handling.md
-- รันไฟล์นี้กับ database ที่ตั้งชื่อไว้ใน server/.env (DB_NAME) เช่น:
--   mysql -u root -p laundry_db < server/db/schema.sql
-- ============================================================

-- ===== Tenancy =====
CREATE TABLE IF NOT EXISTS organizations (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  region        VARCHAR(100),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL
);

CREATE TABLE IF NOT EXISTS hospitals (                      -- = TENANT
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  quota_config    JSON,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- ===== Ward structure: รพ. -> ตึก -> ชั้น -> แผนก -> ตู้ =====
CREATE TABLE IF NOT EXISTS departments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  parent_id     BIGINT UNSIGNED NULL,
  level_type    ENUM('BUILDING','FLOOR','WARD') NOT NULL,
  name          VARCHAR(150) NOT NULL,
  deleted_at    DATETIME NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (parent_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS cabinets (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,
  deleted_at    DATETIME NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS fabric_categories (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id     BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(150) NOT NULL,
  description     VARCHAR(500) NULL,
  max_wash_cycles INT UNSIGNED,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

CREATE TABLE IF NOT EXISTS cabinet_par_levels (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cabinet_id          BIGINT UNSIGNED NOT NULL,
  fabric_category_id  BIGINT UNSIGNED NOT NULL,
  par_level_qty       INT UNSIGNED NOT NULL,
  warning_pct         TINYINT UNSIGNED NOT NULL DEFAULT 20,
  FOREIGN KEY (cabinet_id) REFERENCES cabinets(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id)
);

-- ===== Users & RBAC =====
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NULL,          -- NULL เฉพาะ superadmin
  role          ENUM('SUPERADMIN','ADMIN','OPERATOR') NOT NULL,
  managed_by    BIGINT UNSIGNED NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  pin_hash      CHAR(64) NULL UNIQUE, -- HMAC-SHA256(pin, PIN_PEPPER) — login PIN 6 หลักจาก handheld
  full_name     VARCHAR(150) NOT NULL,
  phone         VARCHAR(30),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
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
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  perm_key      VARCHAR(100) NOT NULL,
  effect        ENUM('GRANT','DENY') NOT NULL,
  granted_by    BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY uq_user_perm (user_id, perm_key)
);

-- ===== Fabric & Lot =====
CREATE TABLE IF NOT EXISTS fabric_lots (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id         BIGINT UNSIGNED NOT NULL,
  fabric_category_id  BIGINT UNSIGNED NULL,
  lot_code            VARCHAR(100) NOT NULL,
  purchased_at        DATE,
  quantity            INT UNSIGNED NOT NULL,
  max_wash_cycles     INT UNSIGNED NULL COMMENT 'override ค่า default ของหมวดหมู่ ถ้ามี',
  max_usage_months    INT UNSIGNED NULL COMMENT 'อายุการใช้งานสูงสุดนับจากวันจัดซื้อ (เดือน)',
  created_by          BIGINT UNSIGNED NOT NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fabric_items (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  epc_code              VARCHAR(64) NOT NULL UNIQUE,
  hospital_id           BIGINT UNSIGNED NOT NULL,
  fabric_category_id    BIGINT UNSIGNED NOT NULL,
  fabric_lot_id         BIGINT UNSIGNED NULL,
  status                ENUM('WASH','CENTRAL_STOCK','WARD_CABINET','IN_USE_WARD',
                              'HOLD','DECOMMISSIONED','PENDING_DECOMMISSION') NOT NULL,
  current_location_type VARCHAR(50),
  current_location_id   BIGINT UNSIGNED NULL,
  wash_count            INT UNSIGNED NOT NULL DEFAULT 0,
  photo_url             VARCHAR(500),
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME NULL,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (fabric_lot_id) REFERENCES fabric_lots(id),
  INDEX idx_hospital_status (hospital_id, status)
);

CREATE TABLE IF NOT EXISTS hold_decommission_records (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fabric_item_id BIGINT UNSIGNED NOT NULL,
  action_type    ENUM('HOLD','DECOMMISSION') NOT NULL,
  reason_code    VARCHAR(100) NOT NULL,
  photo_url      VARCHAR(500),
  created_by     BIGINT UNSIGNED NOT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transfer_records (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fabric_item_id    BIGINT UNSIGNED NOT NULL,
  from_hospital_id  BIGINT UNSIGNED NOT NULL,
  to_hospital_id    BIGINT UNSIGNED NOT NULL,
  approved_by       BIGINT UNSIGNED NOT NULL,
  transferred_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (from_hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (to_hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ===== Devices & Scanning =====
CREATE TABLE IF NOT EXISTS devices (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id            BIGINT UNSIGNED NOT NULL,
  device_type            ENUM('WEIGHT_GATE','FOLDING_TABLE','WARD_KIOSK','HANDHELD') NOT NULL,
  install_location_type  VARCHAR(50),
  install_location_id    BIGINT UNSIGNED NULL,
  rssi_threshold_dbm     INT NOT NULL DEFAULT -65,
  caretaker_name         VARCHAR(150),
  caretaker_phone        VARCHAR(30),
  last_heartbeat_at      DATETIME NULL,
  status                 ENUM('ONLINE','OFFLINE') NOT NULL DEFAULT 'OFFLINE',
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

-- Flow "สแกนเพิ่มผ้าด้วย Handheld": สร้าง lot -> trigger อุปกรณ์ handheld ที่ผูกไว้ให้เข้าโหมดสแกน
-- -> อุปกรณ์ส่งรายการ EPC ที่เจอกลับมา -> แอดมินตรวจสอบแล้วกดยืนยัน ค่อย commit เป็น fabric_items จริง
CREATE TABLE IF NOT EXISTS registration_scan_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id     BIGINT UNSIGNED NOT NULL,
  fabric_lot_id   BIGINT UNSIGNED NOT NULL,
  device_id       BIGINT UNSIGNED NOT NULL,       -- ต้องเป็น devices.device_type = 'HANDHELD'
  status          ENUM('PENDING','SCANNING','REPORTED','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  scanned_epcs    JSON NULL,
  triggered_by    BIGINT UNSIGNED NOT NULL,
  confirmed_by    BIGINT UNSIGNED NULL,
  confirmed_at    DATETIME NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_lot_id) REFERENCES fabric_lots(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (triggered_by) REFERENCES users(id),
  FOREIGN KEY (confirmed_by) REFERENCES users(id)
);

-- อัปเดตทุกครั้งที่ device เปลี่ยนสถานะ online/offline — ใช้คำนวณ uptime % ย้อนหลัง
CREATE TABLE IF NOT EXISTS device_status_log (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id     BIGINT UNSIGNED NOT NULL,
  status        ENUM('ONLINE','OFFLINE') NOT NULL,
  changed_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- "รอบ" จ่ายผ้าไปวอร์ด — เริ่มนับตอนตรวจนับตู้ผ้า (cabinet-audit) สำเร็จ 1 ครั้ง แล้วผ้าที่จ่ายออก
-- ทุกชิ้นในรอบนั้นผูก round_id เดียวกัน ใช้ทำหน้า "ประวัติการจ่ายผ้า" บนมือถือ
CREATE TABLE IF NOT EXISTS ward_issue_rounds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  cabinet_id    BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (cabinet_id) REFERENCES cabinets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" — จุดอ่าน RFID ที่ประตูชั่งน้ำหนัก: สแกนหลาย EPC พร้อมกันเป็นชุด
-- ใช้น้ำหนักเดียวกันทั้งชุด ดู server/db/migrations/018_wash_receive_batches.sql
CREATE TABLE IF NOT EXISTS wash_receive_batches (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  weight_kg     DECIMAL(8,3) NOT NULL,
  item_count    INT UNSIGNED NOT NULL DEFAULT 0,
  user_id       BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- "สแกนเข้าสต๊อค" — สแกนผ้าที่ซัก/อบ/พับเสร็จผ่านเครื่องอ่าน RFID จุดตรวจสอบเป็นชุด (~4-5 ชิ้น/รอบ)
-- ดู server/db/migrations/020_stock_scan_rounds.sql
CREATE TABLE IF NOT EXISTS stock_scan_rounds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  device_id     BIGINT UNSIGNED NULL,
  item_count    INT UNSIGNED NOT NULL DEFAULT 0,
  user_id       BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id         BIGINT UNSIGNED NOT NULL,
  fabric_item_id      BIGINT UNSIGNED NOT NULL,
  device_id           BIGINT UNSIGNED NULL,
  user_id             BIGINT UNSIGNED NULL,
  event_type          ENUM('WEIGHT_COUNT','BUNDLE_CHECK','WARD_ISSUE','WARD_RECEIVE',
                            'HOLD','DECOMMISSION','TRANSFER','CABINET_AUDIT','WASH_RECEIVE',
                            'STOCK_SCAN','STATUS_CHANGE') NOT NULL,
  round_id            BIGINT UNSIGNED NULL,
  batch_id            BIGINT UNSIGNED NULL,
  stock_round_id      BIGINT UNSIGNED NULL,
  weight_kg           DECIMAL(6,3) NULL,
  sensor_error        BOOLEAN NOT NULL DEFAULT FALSE,
  rssi_dbm            INT NULL,
  is_step_skipped     BOOLEAN NOT NULL DEFAULT FALSE,
  latitude            DECIMAL(10,7) NULL,
  longitude           DECIMAL(10,7) NULL,
  synced_from_offline BOOLEAN NOT NULL DEFAULT FALSE,
  scanned_at          DATETIME NOT NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (round_id) REFERENCES ward_issue_rounds(id),
  FOREIGN KEY (batch_id) REFERENCES wash_receive_batches(id),
  FOREIGN KEY (stock_round_id) REFERENCES stock_scan_rounds(id),
  INDEX idx_fabric_scanned (fabric_item_id, scanned_at)
);

-- ===== Offline Sync Conflict Resolution =====
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id                        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id               BIGINT UNSIGNED NOT NULL,
  fabric_item_id            BIGINT UNSIGNED NOT NULL,
  candidate_a_scan_log_id   BIGINT UNSIGNED NOT NULL,
  candidate_b_scan_log_id   BIGINT UNSIGNED NOT NULL,
  status                    ENUM('PENDING','RESOLVED') NOT NULL DEFAULT 'PENDING',
  resolved_scan_log_id      BIGINT UNSIGNED NULL,
  resolved_by               BIGINT UNSIGNED NULL,
  resolved_at               DATETIME NULL,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (candidate_a_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (candidate_b_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (resolved_scan_log_id) REFERENCES scan_logs(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- ===== Audit (append-only — ห้าม UPDATE/DELETE จาก app user) =====
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  action        VARCHAR(150) NOT NULL,
  entity_type   VARCHAR(100) NOT NULL,
  entity_id     BIGINT UNSIGNED NULL,
  metadata      JSON,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
