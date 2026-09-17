import { pool } from '../db/pool.js';

// บันทึกเหตุการณ์ด้านความปลอดภัย/การจัดการบัญชีเข้า audit_logs — ตาราง append-only จริง
// ระดับ DB (ดู server/db/init_security.sql — REVOKE UPDATE, DELETE ไว้แล้ว)
//
// insert ตรงผ่าน pool.query() ไม่ผ่าน scopedQuery() โดยตั้งใจ: audit_logs อยู่ใน
// TENANT_SCOPED_TABLES ก็จริง แต่เหตุการณ์บางอย่าง (login, superadmin สร้าง/ลบโรงพยาบาล)
// ไม่มี tenant เป็นของตัวเอง (hospital_id เป็น NULL ได้) ซึ่ง scopedQuery.insert() จะ throw
// ทันทีถ้า tenantId เป็น null/undefined — ดู docs/multi-tenant-isolation.md ชั้นที่ 5
export async function logAudit({ hospitalId, userId, action, entityType, entityId, metadata }) {
  await pool.query(
    'INSERT INTO audit_logs (hospital_id, user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    [
      hospitalId ?? null,
      userId,
      action,
      entityType,
      entityId ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}
