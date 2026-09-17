-- Device Heartbeat Monitoring ตาม docs/device-network-failure-handling.md หัวข้อ 1
-- device_token_hash: token แยกจาก user JWT โดยสิ้นเชิง (edge device ไม่ใช่ user, ไม่มี role/hospital
-- context ของตัวเอง) ใช้ตรวจสิทธิ์เฉพาะ POST /devices/:id/heartbeat เท่านั้น
ALTER TABLE devices ADD COLUMN device_token_hash VARCHAR(64) NULL AFTER rssi_threshold_dbm;

-- ประวัติการเปลี่ยนสถานะ online/offline ของอุปกรณ์ ใช้คำนวณ uptime % ย้อนหลังได้
CREATE TABLE device_status_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id   BIGINT UNSIGNED NOT NULL,
  status      ENUM('ONLINE', 'OFFLINE') NOT NULL,
  changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  INDEX idx_device_changed (device_id, changed_at)
);
