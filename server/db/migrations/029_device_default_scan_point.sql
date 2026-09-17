-- ตั้ง "อุปกรณ์เริ่มต้น (default)" ของแต่ละจุดสแกนต่อโรงพยาบาล — หน้างานที่มี dropdown เลือก
-- เครื่องอ่าน RFID (เช่น /dashboard/operations/wash-receive) จะเลือกอุปกรณ์ตัวนี้ให้อัตโนมัติ
-- ผู้ใช้ยังเปลี่ยนเป็นเครื่องอื่นเองได้ตามปกติ
--
-- ค่าที่ใช้ได้ใน default_scan_point (source of truth: dashboard/src/sections/devices/device-constants.js):
--   WASH_RECEIVE              — รับผ้าหลังซัก: สแกน+ชั่งน้ำหนัก (ประตูชั่ง / device_type = WEIGHT_GATE)
--   STOCK_SCAN               — สแกนเข้าสต๊อคกลาง (จุดตรวจสอบ / RFID_CHECKPOINT)
--   FABRIC_REGISTER          — ลงทะเบียนผ้าใหม่ ผ่านจุดตรวจสอบ (RFID_CHECKPOINT)
--   FABRIC_REGISTER_HANDHELD — ลงทะเบียนผ้าใหม่ ด้วยเครื่อง Handheld (HANDHELD)
--
-- UNIQUE (hospital_id, default_scan_point): 1 จุด = default ได้ 1 เครื่องต่อโรงพยาบาล
-- MySQL ยอมให้มีหลายแถวที่ default_scan_point = NULL ใน unique index (เครื่องที่ไม่ได้ตั้ง default)
-- controller ยังเคลียร์ default ออกจากเครื่องเดิมให้อัตโนมัติเวลาย้าย default มาเครื่องใหม่
ALTER TABLE devices
  ADD COLUMN default_scan_point VARCHAR(40) NULL AFTER scan_power_dbm,
  ADD UNIQUE KEY uq_device_default_scan_point (hospital_id, default_scan_point);
