-- ตั้งค่าเวลาสูงสุด (Max Timeout Hours) แยกรายสถานะได้ ต่อโรงพยาบาล
-- ตาม Advanced_Feature_Details&Rules.md หัวข้อ C. Sequence Exception & Timeout Monitoring
-- จำกัดเฉพาะสถานะที่อยู่ระหว่างกระบวนการ (ไม่รวม WARD_CABINET/IN_USE_WARD ที่ตั้งใจให้ค้างได้นาน
-- และไม่รวม HOLD/DECOMMISSIONED ที่เป็น exception state อยู่แล้วและมี hold_decommission_records ของตัวเอง)
CREATE TABLE status_timeout_settings (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  status        ENUM('WASH','DRY','WEIGHT_COUNT','FOLDING_QC','CENTRAL_STOCK') NOT NULL,
  max_hours     INT UNSIGNED NOT NULL,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hospital_status (hospital_id, status),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);
