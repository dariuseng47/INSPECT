-- "สแกนเข้าสต๊อค" — สแกนผ้าที่ซัก/อบ/พับเสร็จแล้วผ่านเครื่องอ่าน RFID ที่จุดตรวจสอบ (device_type =
-- 'RFID_CHECKPOINT', ใช้ inventory จริงผ่าน rfid-reader/scan) เป็นชุด (ปกติ ~4-5 ชิ้นต่อรอบ) เพื่อ
-- รีเช็คว่าแท็กยังอ่านได้ครบ แล้วเปลี่ยนสถานะเป็น CENTRAL_STOCK — แต่ละรอบสแกนบันทึกไว้เป็น
-- "รอบการสแกน" ดู server/src/controllers/scans.controller.js#stockScan
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

ALTER TABLE scan_logs
  MODIFY COLUMN event_type ENUM(
    'WEIGHT_COUNT','BUNDLE_CHECK','WARD_ISSUE','WARD_RECEIVE',
    'HOLD','DECOMMISSION','TRANSFER','CABINET_AUDIT','WASH_RECEIVE','STOCK_SCAN'
  ) NOT NULL,
  ADD COLUMN stock_round_id BIGINT UNSIGNED NULL AFTER batch_id,
  ADD FOREIGN KEY (stock_round_id) REFERENCES stock_scan_rounds(id);
