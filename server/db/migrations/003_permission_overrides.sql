-- Phase C: เปิดใช้งาน user_permission_overrides จริง (เดิมเป็นแค่ placeholder ตาม docs/rbac-permissions.md)

-- perm_version เพิ่มเข้า users — client ใช้เทียบกับค่าที่ cache ไว้เพื่อรู้ว่าต้อง refresh
-- permission set ใหม่ (กัน stale permission หลังโดนลดสิทธิ์กะทันหัน) — เดิม auth.controller.js
-- fix ค่าไว้ที่ 1 ตายตัวเป็น placeholder ตอนนี้ผูกกับคอลัมน์จริงแล้ว
ALTER TABLE users ADD COLUMN perm_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER is_active;

-- Permission catalogue — เฉพาะรายการที่ configure ได้จริงผ่าน user_permission_overrides
-- (ตาม docs/rbac-permissions.md ช่อง ⚙️ เท่านั้น ส่วนที่เป็น ❌ ตายตัวไม่ต้องมีใน catalogue นี้
-- เพราะเป็น hard-coded security boundary ในโค้ด ไม่ผ่าน permission table)
INSERT INTO permissions (perm_key, category, description) VALUES
  ('fabric.lot.create', 'fabric', 'ลงทะเบียนล็อตผ้าใหม่ / นำเข้าล็อต'),
  ('fabric.item.hold', 'fabric', 'พักใช้งาน / แทงชำรุดผ้า'),
  ('device.caretaker.update', 'device', 'แก้ไขข้อมูลผู้ดูแลอุปกรณ์ (ชื่อ/เบอร์โทร)')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

-- ค่า default ตาม role (baseline ก่อนโดน override) — admin ได้ทุกสิทธิ์นี้โดยปริยาย
-- operator ได้แค่ fabric.item.hold เป็นค่าเริ่มต้น (เกิดหน้างานบ่อย) ที่เหลือปิดจนกว่า admin จะเปิดให้
INSERT IGNORE INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN', 'fabric.lot.create'),
  ('ADMIN', 'fabric.item.hold'),
  ('ADMIN', 'device.caretaker.update'),
  ('OPERATOR', 'fabric.item.hold');
