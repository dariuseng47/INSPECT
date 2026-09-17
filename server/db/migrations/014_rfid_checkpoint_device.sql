-- เพิ่มชนิดอุปกรณ์ RFID_CHECKPOINT (เครื่องอ่าน RFID แบบ fixed ต่อ LAN ที่จุดตรวจสอบ เช่น
-- SID-U881-8dbi) และคอลัมน์ ip_address/port สำหรับเก็บ endpoint ของตัวอ่าน — เฉพาะ
-- device_type นี้เท่านั้นที่ใช้ 2 คอลัมน์นี้ ตัวอื่น (WEIGHT_GATE ฯลฯ) ยังคงเป็น NULL ตามเดิม
ALTER TABLE devices
  MODIFY COLUMN device_type ENUM('WEIGHT_GATE','FOLDING_TABLE','WARD_KIOSK','HANDHELD','RFID_CHECKPOINT') NOT NULL,
  ADD COLUMN ip_address VARCHAR(45) NULL AFTER install_location_id,
  ADD COLUMN port INT UNSIGNED NULL AFTER ip_address;
