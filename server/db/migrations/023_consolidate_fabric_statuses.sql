-- ยุบสถานะผ้าให้เหลือ lifecycle 4 สถานะ + exception state เดิม
--   WASH  = "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" (รวม DRY/WEIGHT_COUNT/FOLDING_QC เดิมเข้าด้วยกัน)
--   CENTRAL_STOCK = สต๊อกกลาง
--   WARD_CABINET  = ตู้แผนก
--   IN_USE_WARD   = ใช้งานที่วอร์ด
-- exception (คงไว้): HOLD / DECOMMISSIONED / PENDING_DECOMMISSION
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 023_consolidate_fabric_statuses.sql

-- 1) ย้ายผ้าที่ค้างสถานะย่อยเดิมมารวมเป็น WASH ก่อน แล้วค่อยตัดค่าออกจาก ENUM
UPDATE fabric_items SET status = 'WASH'
  WHERE status IN ('DRY', 'WEIGHT_COUNT', 'FOLDING_QC');

ALTER TABLE fabric_items
  MODIFY COLUMN status ENUM(
    'WASH','CENTRAL_STOCK','WARD_CABINET','IN_USE_WARD',
    'HOLD','DECOMMISSIONED','PENDING_DECOMMISSION'
  ) NOT NULL;

-- 2) status_timeout_settings เดิมตั้งค่าได้ 5 สถานะ — เหลือ WASH / CENTRAL_STOCK
--    ลบ row ของสถานะย่อยที่ยุบไปแล้ว (ค่า WASH เดิมของแต่ละโรงพยาบาลยังอยู่ ถ้าไม่มีก็ตั้งใหม่ได้
--    ในหน้า "ตั้งค่า Timeout" — เป็น config ไม่ใช่ข้อมูลจริง)
DELETE FROM status_timeout_settings WHERE status IN ('DRY', 'WEIGHT_COUNT', 'FOLDING_QC');

ALTER TABLE status_timeout_settings
  MODIFY COLUMN status ENUM('WASH','CENTRAL_STOCK') NOT NULL;
