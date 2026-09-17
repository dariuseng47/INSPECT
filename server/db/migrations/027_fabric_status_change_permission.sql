-- สิทธิ์ใหม่: fabric.item.status_change — เปลี่ยนสถานะผ้าด้วยมือ
-- ใช้ร่วมกันระหว่างเมนู "เปลี่ยนสถานะผ้า" บนมือถือ (nativeapp/) และปุ่มเปลี่ยนสถานะใน popup
-- "ผ้ารหัส..." หน้าคลังผ้า (dashboard /dashboard/fabric) — endpoint เดียวกัน
-- POST /api/v1/scans/status-change (ดู server/src/controllers/scans.controller.js#statusChange)
--
-- superadmin ได้สิทธิ์นี้เสมอ (hasPermission() ลัดคืน true) — admin ของโรงพยาบาลและ operator
-- ไม่ได้ default ต้องให้ผู้ดูแลเปิดให้เป็นรายคนผ่านหน้าจัดการสิทธิ์ (จงใจไม่ INSERT
-- role_default_permissions) การมอบสิทธิ์ยังต้องผ่านกฎ delegation เดิม: ผู้มอบต้องมีสิทธิ์นี้
-- effective = true อยู่ก่อน ถึง GRANT ต่อให้คนอื่นได้ (ดู permissions.controller.js)
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 027_fabric_status_change_permission.sql

INSERT INTO permissions (perm_key, category, description) VALUES
  ('fabric.item.status_change', 'fabric', 'เปลี่ยนสถานะผ้าด้วยมือ (หน้าคลังผ้า / เมนูมือถือ)')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);
