-- ตาม docs/device-network-failure-handling.md หัวข้อ 3 — Sensor-Level Failure
-- อ่านค่า weight scale ไม่ได้ (serial error/timeout) ไม่ block pipeline: บันทึก weight_kg = NULL,
-- sensor_error = TRUE แยกออกจาก step-skipped exception ทางธุรกิจ (is_step_skipped)
ALTER TABLE scan_logs ADD COLUMN sensor_error BOOLEAN NOT NULL DEFAULT FALSE AFTER is_step_skipped;
