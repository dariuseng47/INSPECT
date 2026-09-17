-- Popup รูปภาพหลัง login (superadmin เท่านั้นที่จัดการได้ ตาม docs/rbac-permissions.md)
-- roles เก็บเป็น JSON array ของ role ที่เห็นรูปนี้ (เช่น ["SUPERADMIN","ADMIN"]) — แพทเทิร์นเดียวกับ
-- devices.default_scan_points (030_device_default_scan_points_multi.sql) สำหรับ field แบบเลือกได้หลายค่า
-- ถ้า role หนึ่งมีหลายรูป (หลายแถวที่ roles ของแถวนั้นมี role นั้นอยู่) ฝั่ง frontend จะรวมเป็น slide
-- ใน popup เดียวกันเรียงตาม sort_order
CREATE TABLE login_popup_images (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_url   VARCHAR(500) NOT NULL,
  roles       JSON NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by  BIGINT UNSIGNED NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
