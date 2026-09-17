-- Global System Config (ตั้งค่ามาตรฐานกลาง) — superadmin เท่านั้น ตาม docs/rbac-permissions.md
-- แถวเดียว (id=1 เสมอ) ใช้เป็นค่า default กลางที่ระบบ fallback ไปใช้เมื่อจุดที่เกี่ยวข้องไม่ได้ระบุค่ามาเอง
CREATE TABLE global_settings (
  id                          TINYINT UNSIGNED PRIMARY KEY DEFAULT 1,
  default_rssi_threshold_dbm  INT NOT NULL DEFAULT -65,
  default_par_level_warning_pct TINYINT UNSIGNED NOT NULL DEFAULT 20,
  updated_at                  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by                  BIGINT UNSIGNED NULL,
  CONSTRAINT chk_global_settings_singleton CHECK (id = 1),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

INSERT INTO global_settings (id, default_rssi_threshold_dbm, default_par_level_warning_pct)
VALUES (1, -65, 20);
