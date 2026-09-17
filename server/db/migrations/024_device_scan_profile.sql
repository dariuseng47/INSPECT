-- ตั้งค่าการสแกนของเครื่องอ่าน RFID ที่ server ต่อเข้าไปอ่านเอง (RFID_CHECKPOINT / WEIGHT_GATE)
-- ปรับได้ต่อเครื่องในหน้า "อุปกรณ์ & สัญญาณ RFID"
--
-- scan_profile — ความเร็ว/ความละเอียด: server ยิงคำสั่ง inventory ซ้ำจนไม่เจอ EPC ใหม่ติดกันหลายรอบ
--   FAST     = จบไว เหมาะสแกนของที่วางนิ่ง จำนวนน้อย
--   NORMAL   = ค่ากลาง (ค่าเริ่มต้น)
--   THOROUGH = อ่านนานขึ้น เหมาะเข็นรถเข็นผ้าผ่านเครื่องช้าๆ / ผ้าจำนวนมาก
--
-- scan_power_dbm — ความแรงสัญญาณ RF ของเครื่องอ่าน (0-18 dBm ตาม SDK SID_U861, SetPowerDbm)
--   ยิ่งสูง = ระยะอ่านไกลขึ้น แต่มีโอกาสอ่านแท็กข้างเคียงที่ไม่ต้องการติดมาด้วย
--   NULL = ไม่สั่งตั้งค่า ใช้ค่าที่ตั้งไว้ในตัวเครื่องเดิม
ALTER TABLE devices
  ADD COLUMN scan_profile ENUM('FAST','NORMAL','THOROUGH') NOT NULL DEFAULT 'NORMAL' AFTER port,
  ADD COLUMN scan_power_dbm TINYINT UNSIGNED NULL AFTER scan_profile;
