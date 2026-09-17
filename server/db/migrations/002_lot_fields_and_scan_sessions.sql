-- ย้ายหมวดหมู่ผ้า + เกณฑ์อายุการใช้งานมาอยู่ระดับ "ล็อต" (lot) แทนที่จะกรอกซ้ำทุกครั้งตอนลงทะเบียนรายชิ้น
-- และเพิ่มตาราง registration_scan_sessions รองรับ flow "สแกนเพิ่มผ้าด้วย Handheld"
-- (สร้าง lot -> เลือกอุปกรณ์ handheld -> trigger ให้ตัวเครื่องเข้าโหมดสแกน -> เครื่องส่งรายการ EPC
--  กลับมา -> แอดมินตรวจสอบแล้วกดยืนยันบนเว็บ ค่อย commit เป็น fabric_items จริง)
--
-- รันกับ database เดิมที่มีอยู่แล้ว: mysql -u <user> -p <db> < 002_lot_fields_and_scan_sessions.sql

ALTER TABLE fabric_lots
  ADD COLUMN fabric_category_id BIGINT UNSIGNED NULL AFTER hospital_id,
  ADD COLUMN max_wash_cycles INT UNSIGNED NULL COMMENT 'override ค่า default ของหมวดหมู่ ถ้ามี',
  ADD COLUMN max_usage_months INT UNSIGNED NULL COMMENT 'อายุการใช้งานสูงสุดนับจากวันจัดซื้อ (เดือน)',
  ADD CONSTRAINT fk_fabric_lots_category
    FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id);

CREATE TABLE IF NOT EXISTS registration_scan_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id     BIGINT UNSIGNED NOT NULL,
  fabric_lot_id   BIGINT UNSIGNED NOT NULL,
  device_id       BIGINT UNSIGNED NOT NULL,       -- ต้องเป็น devices.device_type = 'HANDHELD'
  status          ENUM('PENDING','SCANNING','REPORTED','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  scanned_epcs    JSON NULL,                       -- รายการ EPC ที่ handheld ส่งกลับมา (ก่อน confirm)
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
