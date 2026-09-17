-- ตาม Advanced_Feature_Details&Rules.md หัวข้อ Folding & QC Table:
-- "ตั้งค่า target_bundle_size ได้ (เช่น 5 หรือ 6 ชิ้น/มัด)" — มีความหมายเฉพาะกับ FOLDING_TABLE
-- device เท่านั้น (คล้าย rssi_threshold_dbm ที่ config ต่อเครื่อง) NULL = ไม่เช็คจำนวนชิ้น/มัด
ALTER TABLE devices ADD COLUMN target_bundle_size INT UNSIGNED NULL AFTER rssi_threshold_dbm;
