-- ลบอุปกรณ์แบบ soft delete — devices มี FK จากหลายตาราง (scan_logs, device_status_log,
-- registration_scan_sessions ฯลฯ) ลบจริงไม่ได้ถ้ามีประวัติ จึงใช้ deleted_at เหมือนตารางอื่นในระบบ
ALTER TABLE devices
  ADD COLUMN deleted_at DATETIME NULL;
