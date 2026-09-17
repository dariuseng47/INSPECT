-- "รอบ" จ่ายผ้าไปวอร์ด — เริ่มนับตอนตรวจนับตู้ผ้า (cabinet-audit) สำเร็จ 1 ครั้ง แล้วผ้าที่จ่ายออก
-- (ward-issue) ทุกชิ้นในรอบนั้นจะผูก round_id เดียวกัน ใช้ทำหน้า "ประวัติการจ่ายผ้า" บนมือถือ — สรุป
-- แต่ละรอบว่าจ่ายอะไรไปบ้าง กี่ชิ้น (ดู server/src/controllers/scans.controller.js)
CREATE TABLE IF NOT EXISTS ward_issue_rounds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id   BIGINT UNSIGNED NOT NULL,
  cabinet_id    BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (cabinet_id) REFERENCES cabinets(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE scan_logs
  ADD COLUMN round_id BIGINT UNSIGNED NULL AFTER event_type,
  ADD FOREIGN KEY (round_id) REFERENCES ward_issue_rounds(id);
