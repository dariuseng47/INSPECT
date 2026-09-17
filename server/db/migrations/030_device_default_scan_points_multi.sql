-- เดิม (029) 1 เครื่อง = ตั้งเป็น default ได้จุดเดียว (คอลัมน์ default_scan_point + UNIQUE)
-- เปลี่ยนเป็น 1 เครื่องตั้งเป็น default ได้หลายจุด — เก็บเป็น JSON array ของ scan point key
--
-- กติกา "1 จุด = default ได้ 1 เครื่องต่อโรงพยาบาล" ยังอยู่ แต่บังคับใน controller
-- (devices.controller.js -> assertAndClearScanPoints) เพราะ MySQL/MariaDB ทำ UNIQUE บนสมาชิก
-- ใน JSON array ตรงๆ ไม่ได้ — เวลาตั้งจุดให้เครื่องใหม่ controller จะถอดจุดนั้นออกจากเครื่องอื่นเอง
--
-- หมายเหตุ: uq_device_default_scan_point (029) มี hospital_id เป็นคอลัมน์นำ InnoDB จึงใช้ index นี้
-- ค้ำ FK devices_ibfk_1 (hospital_id -> hospitals.id) อยู่ ต้องสร้าง index เดี่ยวของ hospital_id
-- ขึ้นมาแทนก่อน ถึงจะ DROP index ตัวเก่าได้

ALTER TABLE devices
  ADD INDEX idx_devices_hospital (hospital_id),
  ADD COLUMN default_scan_points JSON NULL AFTER default_scan_point;

-- ย้ายค่าเดิม: 'WASH_RECEIVE' -> ["WASH_RECEIVE"]
UPDATE devices
  SET default_scan_points = JSON_ARRAY(default_scan_point)
  WHERE default_scan_point IS NOT NULL;

ALTER TABLE devices
  DROP INDEX uq_device_default_scan_point,
  DROP COLUMN default_scan_point;
