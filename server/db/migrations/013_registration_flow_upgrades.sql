-- 1) ผ้าทุกชิ้นเก็บว่า "ใครแอดมา" (ทั้ง 3 ทาง: ลงทะเบียนรายชิ้น/bulk บนเว็บ, และ confirm scan
--    session จาก handheld/มือถือ — created_by = คนที่ trigger/scan ไม่ใช่คน confirm)
ALTER TABLE fabric_items
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER photo_url,
  ADD FOREIGN KEY (created_by) REFERENCES users(id);

-- 2) registration_scan_sessions (flow "สแกนด้วย Handheld") เดิมบังคับผูกล็อตเสมอ — เปลี่ยนให้
--    เลือกได้ว่าจะผูกล็อต (fabric_lot_id) หรือระบุแค่หมวดหมู่ตรงๆ (fabric_category_id) ก็ได้
--    อย่างใดอย่างหนึ่ง ดู server/src/controllers/scanSessions.controller.js
ALTER TABLE registration_scan_sessions
  MODIFY COLUMN fabric_lot_id BIGINT UNSIGNED NULL,
  ADD COLUMN fabric_category_id BIGINT UNSIGNED NULL AFTER fabric_lot_id,
  ADD FOREIGN KEY (fabric_category_id) REFERENCES fabric_categories(id);
