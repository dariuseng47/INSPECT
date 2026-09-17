-- ขั้นตอนที่ 1 ของ flow "จ่ายผ้าไปวอร์ด" ใหม่: สแกนหน้าตู้เพื่อตรวจนับของคงเหลือ + กระทบยอดกับ
-- par level ก่อนค่อยหยิบผ้าจากรถมาจัดเข้า (WARD_ISSUE เดิม) — ดู server/src/controllers/scans.controller.js
ALTER TABLE scan_logs
  MODIFY COLUMN event_type ENUM(
    'WEIGHT_COUNT','BUNDLE_CHECK','WARD_ISSUE','WARD_RECEIVE',
    'HOLD','DECOMMISSION','TRANSFER','CABINET_AUDIT'
  ) NOT NULL;
