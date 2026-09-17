-- ============================================================================
-- 028: RBAC ยกเครื่อง — hospital scopes + สิทธิ์ราย "เมนู" (view/edit) + handheld
--
-- สรุปการเปลี่ยนแปลง (ดู server/src/config/menuCatalog.js เป็น source of truth):
--   1. ตาราง user_hospital_scopes — แอดมิน/พนักงาน ดูแลได้หลายโรงพยาบาล (แทน users.hospital_id
--      เดี่ยว) แต่ละแถวระบุ can_edit แยก (ดูอย่างเดียว / แก้ไขได้)
--   2. users.handheld_enabled       — master switch ว่าบัญชีนี้ใช้เครื่องพกพาได้ไหม
--   3. users.can_manage_subordinates — แอดมินคนนี้สร้าง/จัดการพนักงานใต้ตัวเองได้ไหม
--   4. user_permission_overrides.superadmin_locked — override ที่ superadmin ตั้ง แอดมินแก้ทับไม่ได้
--   5. permissions catalogue ใหม่ทั้งชุด: web.<module>.<view|edit> + handheld.<module>.<view|edit>
--   6. remap user_permission_overrides เดิม 5 คีย์ -> คีย์เมนูใหม่ แล้วลบคีย์เก่าทิ้ง
--   7. seed role_default_permissions ใหม่ (ADMIN = เต็มทุกเมนูในโรงพยาบาลตัวเอง, OPERATOR = งานหน้างาน)
--
-- รันกับ database เดิม:  mysql -u <user> -p <db> < 028_rbac_scopes_menu_permissions.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) user_hospital_scopes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_hospital_scopes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  hospital_id BIGINT UNSIGNED NOT NULL,
  can_edit    TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = ดูอย่างเดียวในโรงพยาบาลนี้',
  granted_by  BIGINT UNSIGNED NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_hospital (user_id, hospital_id),
  INDEX idx_uhs_user (user_id),
  INDEX idx_uhs_hospital (hospital_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- backfill: ทุก admin/operator ที่มี hospital_id อยู่แล้ว = มี scope โรงพยาบาลนั้นแบบแก้ไขได้
INSERT IGNORE INTO user_hospital_scopes (user_id, hospital_id, can_edit, granted_by)
SELECT id, hospital_id, 1, managed_by
FROM users
WHERE hospital_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2) + 3) ธง master ระดับ user
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN handheld_enabled TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'บัญชีนี้ล็อกอินเครื่องพกพา (handheld) ได้ไหม — superadmin ข้ามเช็คนี้เสมอ'
    AFTER perm_version,
  ADD COLUMN can_manage_subordinates TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'แอดมินสร้าง/แก้ไข/ลบ พนักงาน (operator) ใต้ตัวเองได้ไหม — ไม่มีผลกับ superadmin/operator'
    AFTER handheld_enabled;

-- ---------------------------------------------------------------------------
-- 4) superadmin_locked บน override
-- ---------------------------------------------------------------------------
ALTER TABLE user_permission_overrides
  ADD COLUMN superadmin_locked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = override นี้ตั้งโดย superadmin — แอดมินของโรงพยาบาลแก้/ลบทับไม่ได้'
    AFTER granted_by;

-- ---------------------------------------------------------------------------
-- 5) permissions catalogue ใหม่
--    category = '<channel>:<group>' เพื่อ group ได้ทั้งสองมิติในหน้าตั้งค่า
-- ---------------------------------------------------------------------------
INSERT INTO permissions (perm_key, category, description) VALUES
  -- WEB : แดชบอร์ดโรงพยาบาล
  ('web.dashboard.overview.view',         'web:dashboard', 'ดู: แดชบอร์ดโรงพยาบาล'),
  ('web.dashboard.hospital_profile.view', 'web:dashboard', 'ดู: แดชบอร์ด (โปรไฟล์โรงพยาบาล)'),
  ('web.alerts.view',                     'web:dashboard', 'ดู: แจ้งเตือน & ข้อยกเว้น'),
  ('web.wash_analytics.view',             'web:dashboard', 'ดู: วิเคราะห์การซัก & ทรัพย์สิน'),
  ('web.tracking.view',                   'web:dashboard', 'ดู: ติดตามสถานะกระบวนการ'),
  -- WEB : ปฏิบัติการ & ติดตามผ้า
  ('web.operations.wash_receive.view',    'web:operations', 'ดู: รับผ้าหลังซัก & ชั่งน้ำหนักผ้า'),
  ('web.operations.wash_receive.edit',    'web:operations', 'แก้ไข: รับผ้าหลังซัก & ชั่งน้ำหนักผ้า'),
  ('web.operations.stock_scan.view',      'web:operations', 'ดู: สแกนเข้าสต๊อค'),
  ('web.operations.stock_scan.edit',      'web:operations', 'แก้ไข: สแกนเข้าสต๊อค'),
  ('web.operations.ward.view',            'web:operations', 'ดู: รับ-ส่งผ้าประจำวอร์ด'),
  ('web.operations.ward.edit',            'web:operations', 'แก้ไข: รับ-ส่งผ้าประจำวอร์ด'),
  ('web.operations.restock_report.view',  'web:operations', 'ดู: ประวัติ & วิเคราะห์การเติมผ้า'),
  -- WEB : จัดการผ้าและล็อต
  ('web.fabric.inventory.view',           'web:fabric', 'ดู: คลังผ้าทั้งหมด'),
  ('web.fabric.inventory.edit',           'web:fabric', 'แก้ไข: คลังผ้า (เปลี่ยนสถานะผ้าด้วยมือ)'),
  ('web.fabric.register.view',            'web:fabric', 'ดู: ลงทะเบียนผ้า / ล็อต'),
  ('web.fabric.register.edit',            'web:fabric', 'แก้ไข: ลงทะเบียนผ้า / ล็อต'),
  ('web.fabric.hold.view',                'web:fabric', 'ดู: รายการพัก & ชำรุด'),
  ('web.fabric.hold.edit',                'web:fabric', 'แก้ไข: พักใช้งาน / แทงชำรุดผ้า'),
  ('web.fabric.decommissioned.view',      'web:fabric', 'ดู: ประวัติผ้าที่จำหน่ายออก'),
  -- WEB : โครงสร้าง & อุปกรณ์
  ('web.organization.view',               'web:structure', 'ดู: โครงสร้างโรงพยาบาล'),
  ('web.organization.edit',               'web:structure', 'แก้ไข: โครงสร้างโรงพยาบาล'),
  ('web.devices.view',                    'web:device', 'ดู: อุปกรณ์ & สัญญาณ RFID'),
  ('web.devices.edit',                    'web:device', 'แก้ไข: อุปกรณ์ & สัญญาณ RFID (config/เพิ่ม-ลบ)'),
  ('web.devices.caretaker.edit',          'web:device', 'แก้ไข: ข้อมูลผู้ดูแลอุปกรณ์ (ชื่อ/เบอร์โทร)'),
  -- WEB : ความปลอดภัย & ตั้งค่าระบบ
  ('web.security.users.view',             'web:security', 'ดู: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.users.edit',             'web:security', 'แก้ไข: ผู้ใช้งาน & สิทธิ์การเข้าถึง'),
  ('web.security.timeouts.view',          'web:security', 'ดู: ตั้งค่าเวลาค้างสถานะ'),
  ('web.security.timeouts.edit',          'web:security', 'แก้ไข: ตั้งค่าเวลาค้างสถานะ'),
  ('web.security.audit_logs.view',        'web:security', 'ดู: ประวัติการใช้งานระบบ'),
  ('web.security.sync_conflicts.view',    'web:security', 'ดู: ข้อมูลชนกันจากออฟไลน์'),
  ('web.security.sync_conflicts.edit',    'web:security', 'แก้ไข: ข้อมูลชนกันจากออฟไลน์'),
  -- HANDHELD
  ('handheld.inventory.view',             'handheld:inventory', 'ดู: คลังผ้า (ค้นหา / รายชิ้น)'),
  ('handheld.inventory.edit',             'handheld:inventory', 'แก้ไข: ลงทะเบียนผ้าเข้าคลังจากเครื่อง'),
  ('handheld.location.view',              'handheld:inventory', 'ดู: ค้นหาตำแหน่งผ้า'),
  ('handheld.ward.view',                  'handheld:operations', 'ดู: รับ-ส่งผ้าวอร์ด'),
  ('handheld.ward.edit',                  'handheld:operations', 'แก้ไข: รับ-ส่งผ้าวอร์ด'),
  ('handheld.ward_history.view',          'handheld:operations', 'ดู: ประวัติการจ่ายผ้า'),
  ('handheld.status_change.view',         'handheld:fabric', 'ดู: เปลี่ยนสถานะผ้า'),
  ('handheld.status_change.edit',         'handheld:fabric', 'แก้ไข: เปลี่ยนสถานะผ้าด้วยมือ'),
  ('handheld.hold.view',                  'handheld:fabric', 'ดู: พัก & ชำรุด'),
  ('handheld.hold.edit',                  'handheld:fabric', 'แก้ไข: พักใช้งาน / แทงชำรุดผ้า')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

-- ---------------------------------------------------------------------------
-- 6) remap user_permission_overrides เดิม -> คีย์ใหม่ (คง effect + granted_by)
--    override เดิมทั้งหมดถือว่า "ไม่ได้ตั้งโดย superadmin โดยเฉพาะ" -> superadmin_locked = 0
-- ---------------------------------------------------------------------------
INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'web.fabric.register.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.lot.create'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'handheld.inventory.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.lot.create'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'web.fabric.hold.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.item.hold'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'handheld.hold.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.item.hold'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'web.fabric.inventory.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.item.status_change'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'handheld.status_change.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'fabric.item.status_change'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'web.devices.caretaker.edit', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'device.caretaker.update'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
SELECT user_id, 'web.dashboard.hospital_profile.view', effect, granted_by
FROM user_permission_overrides WHERE perm_key = 'dashboard.hospital_profile.view'
ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by);

DELETE FROM user_permission_overrides WHERE perm_key IN (
  'fabric.lot.create', 'fabric.item.hold', 'fabric.item.status_change',
  'device.caretaker.update', 'dashboard.hospital_profile.view'
);

-- ---------------------------------------------------------------------------
-- 7) role_default_permissions ใหม่ (ล้างของเดิมทั้งหมด — เป็นคีย์ legacy ล้วน)
-- ---------------------------------------------------------------------------
DELETE FROM role_default_permissions;

INSERT INTO role_default_permissions (role, perm_key) VALUES
  -- ===== ADMIN = เต็มทุกเมนูภายในโรงพยาบาลตัวเอง (ยกเว้น HQ ที่เป็น boundary ตายตัว) =====
  ('ADMIN', 'web.dashboard.overview.view'),
  ('ADMIN', 'web.dashboard.hospital_profile.view'),
  ('ADMIN', 'web.alerts.view'),
  ('ADMIN', 'web.wash_analytics.view'),
  ('ADMIN', 'web.tracking.view'),
  ('ADMIN', 'web.operations.wash_receive.view'),
  ('ADMIN', 'web.operations.wash_receive.edit'),
  ('ADMIN', 'web.operations.stock_scan.view'),
  ('ADMIN', 'web.operations.stock_scan.edit'),
  ('ADMIN', 'web.operations.ward.view'),
  ('ADMIN', 'web.operations.ward.edit'),
  ('ADMIN', 'web.operations.restock_report.view'),
  ('ADMIN', 'web.fabric.inventory.view'),
  ('ADMIN', 'web.fabric.inventory.edit'),
  ('ADMIN', 'web.fabric.register.view'),
  ('ADMIN', 'web.fabric.register.edit'),
  ('ADMIN', 'web.fabric.hold.view'),
  ('ADMIN', 'web.fabric.hold.edit'),
  ('ADMIN', 'web.fabric.decommissioned.view'),
  ('ADMIN', 'web.organization.view'),
  ('ADMIN', 'web.organization.edit'),
  ('ADMIN', 'web.devices.view'),
  ('ADMIN', 'web.devices.edit'),
  ('ADMIN', 'web.devices.caretaker.edit'),
  ('ADMIN', 'web.security.users.view'),
  ('ADMIN', 'web.security.users.edit'),
  ('ADMIN', 'web.security.timeouts.view'),
  ('ADMIN', 'web.security.timeouts.edit'),
  ('ADMIN', 'web.security.audit_logs.view'),
  ('ADMIN', 'web.security.sync_conflicts.view'),
  ('ADMIN', 'web.security.sync_conflicts.edit'),
  ('ADMIN', 'handheld.inventory.view'),
  ('ADMIN', 'handheld.inventory.edit'),
  ('ADMIN', 'handheld.location.view'),
  ('ADMIN', 'handheld.ward.view'),
  ('ADMIN', 'handheld.ward.edit'),
  ('ADMIN', 'handheld.ward_history.view'),
  ('ADMIN', 'handheld.status_change.view'),
  ('ADMIN', 'handheld.status_change.edit'),
  ('ADMIN', 'handheld.hold.view'),
  ('ADMIN', 'handheld.hold.edit'),
  -- ===== OPERATOR = งานหน้างาน (ดูได้กว้าง, แก้เฉพาะการสแกน/พักผ้า) =====
  ('OPERATOR', 'web.dashboard.overview.view'),
  ('OPERATOR', 'web.alerts.view'),
  ('OPERATOR', 'web.wash_analytics.view'),
  ('OPERATOR', 'web.tracking.view'),
  ('OPERATOR', 'web.operations.wash_receive.view'),
  ('OPERATOR', 'web.operations.wash_receive.edit'),
  ('OPERATOR', 'web.operations.stock_scan.view'),
  ('OPERATOR', 'web.operations.stock_scan.edit'),
  ('OPERATOR', 'web.operations.ward.view'),
  ('OPERATOR', 'web.operations.ward.edit'),
  ('OPERATOR', 'web.operations.restock_report.view'),
  ('OPERATOR', 'web.fabric.inventory.view'),
  ('OPERATOR', 'web.fabric.hold.view'),
  ('OPERATOR', 'web.fabric.hold.edit'),
  ('OPERATOR', 'web.fabric.decommissioned.view'),
  ('OPERATOR', 'handheld.inventory.view'),
  ('OPERATOR', 'handheld.inventory.edit'),
  ('OPERATOR', 'handheld.location.view'),
  ('OPERATOR', 'handheld.ward.view'),
  ('OPERATOR', 'handheld.ward.edit'),
  ('OPERATOR', 'handheld.ward_history.view'),
  ('OPERATOR', 'handheld.hold.view'),
  ('OPERATOR', 'handheld.hold.edit');

-- ---------------------------------------------------------------------------
-- 8) ลบ permissions catalogue เก่า (คีย์ legacy 5 ตัว) หลัง remap เสร็จแล้ว
-- ---------------------------------------------------------------------------
DELETE FROM permissions WHERE perm_key IN (
  'fabric.lot.create', 'fabric.item.hold', 'fabric.item.status_change',
  'device.caretaker.update', 'dashboard.hospital_profile.view'
);
