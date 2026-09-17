-- เมนู "เปลี่ยนสถานะผ้า" บนมือถือ (nativeapp/) — สแกนผ้าเป็นชุด เลือกสถานะก่อน/หลังเอง แล้วเปลี่ยน
-- รวดเดียว เป็นเครื่องมือแก้/ปรับสถานะด้วยมือสำหรับเคสตกหล่น (ผ้าที่หลุด flow ปกติ) ทุกชิ้นที่เปลี่ยน
-- มี scan_logs event_type = 'STATUS_CHANGE' เก็บสถานะเดิมไว้ใน metadata { fromStatus, toStatus,
-- prevStatus, mismatched } — ดู server/src/controllers/scans.controller.js#statusChange
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 022_status_change_scan.sql

ALTER TABLE scan_logs
  MODIFY COLUMN event_type ENUM(
    'WEIGHT_COUNT','BUNDLE_CHECK','WARD_ISSUE','WARD_RECEIVE',
    'HOLD','DECOMMISSION','TRANSFER','CABINET_AUDIT','WASH_RECEIVE','STOCK_SCAN','STATUS_CHANGE'
  ) NOT NULL;
