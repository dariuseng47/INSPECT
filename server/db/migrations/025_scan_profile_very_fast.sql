-- เพิ่มระดับ "เร็วมาก" (VERY_FAST) ให้ scan_profile — รอบละ ~200ms เหมาะกับโหมดอ่านอัตโนมัติ
-- (dashboard ยิงสแกนซ้ำต่อเนื่องจนกดเพิ่มเข้าระบบ)
ALTER TABLE devices
  MODIFY COLUMN scan_profile ENUM('VERY_FAST','FAST','NORMAL','THOROUGH') NOT NULL DEFAULT 'NORMAL';
