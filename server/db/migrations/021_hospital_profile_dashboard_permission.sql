-- เพิ่ม permission ใหม่: dashboard.hospital_profile.view — ดูแดชบอร์ดโปรไฟล์โรงพยาบาล
-- (หน้าใหม่ /dashboard/hospital-profile แยกจาก /dashboard/hq/hospitals/:id ที่ล็อก superadmin
-- เท่านั้นตาม hard-coded boundary ใน docs/rbac-permissions.md — หน้าใหม่นี้ configure ได้ผ่าน
-- user_permission_overrides ตามปกติ ไม่ผูกกับ HQ boundary)

INSERT INTO permissions (perm_key, category, description) VALUES
  ('dashboard.hospital_profile.view', 'dashboard', 'ดูแดชบอร์ดโปรไฟล์โรงพยาบาล')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

-- admin ได้สิทธิ์นี้เป็นค่าเริ่มต้น (endpoint /dashboard-summary เดิมก็เปิดให้ admin เข้าได้อยู่แล้ว)
-- operator ไม่ได้ default ต้องให้ admin ของโรงพยาบาลตัวเองเปิดให้เป็นรายคนผ่านหน้าจัดการสิทธิ์
INSERT IGNORE INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN', 'dashboard.hospital_profile.view');
