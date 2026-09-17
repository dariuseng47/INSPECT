-- สร้าง App DB user สิทธิ์ต่ำสุด (ไม่ใช้ root ต่อจาก backend) ตาม Principal_Software_Security_Engineer.md
-- แก้ 'CHANGE_ME_STRONG_PASSWORD' ก่อนรันจริง แล้วนำ user/password นี้ไปกรอกใน server/.env (DB_USER / DB_PASSWORD)

CREATE USER IF NOT EXISTS 'laundry_app_user'@'%' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD';

GRANT SELECT, INSERT, UPDATE, DELETE ON laundry_db.* TO 'laundry_app_user'@'%';

-- audit_logs ควรเป็น append-only จริงๆ ระดับ DB ด้วย (ชั้นป้องกันเพิ่มจาก app-layer)
REVOKE UPDATE, DELETE ON laundry_db.audit_logs FROM 'laundry_app_user'@'%';

FLUSH PRIVILEGES;
