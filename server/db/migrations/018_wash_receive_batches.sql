-- "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" — จุดอ่าน RFID ที่ประตูชั่งน้ำหนัก: ผ้าที่กลับมาจากซัก/อบ/พับ
-- ถูกสแกนพร้อมกันเป็นชุด (หลาย EPC) ใช้น้ำหนักเดียวกันทั้งชุด แล้วเปลี่ยนสถานะจาก IN_USE_WARD/
-- WARD_CABINET ตรงเป็น WASH รวดเดียว (ระบบนี้ไม่ได้แยกติดตาม DRY/WEIGHT_COUNT/FOLDING_QC เป็นจุด
-- สแกนย่อยจริง ไปดูที่ dashboard/src/sections/fabric/fabric-constants.js — label WASH ถูกเปลี่ยนเป็น
-- "ซัก/อบ/พับ" ให้สื่อความหมายรวมนี้) — สแกน/ชั่งจริงยังไม่เชื่อมฮาร์ดแวร์ ตอนนี้กรอกเองจากหน้าเว็บ
-- ก่อน (เหมือน pattern manual entry stand-in ที่ scans.controller.js ใช้กับจุดอื่นอยู่แล้ว)
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

ALTER TABLE scan_logs
  MODIFY COLUMN event_type ENUM(
    'WEIGHT_COUNT','BUNDLE_CHECK','WARD_ISSUE','WARD_RECEIVE',
    'HOLD','DECOMMISSION','TRANSFER','CABINET_AUDIT','WASH_RECEIVE'
  ) NOT NULL,
  ADD COLUMN batch_id BIGINT UNSIGNED NULL AFTER round_id,
  ADD FOREIGN KEY (batch_id) REFERENCES wash_receive_batches(id);
