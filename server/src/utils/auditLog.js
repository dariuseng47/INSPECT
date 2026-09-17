import { pool } from '../db/pool.js';

// บันทึกเหตุการณ์ด้านความปลอดภัย/การจัดการบัญชีเข้า audit_logs — ตาราง append-only จริง
// ระดับ DB (ดู server/db/init_security.sql — REVOKE UPDATE, DELETE ไว้แล้ว)
export async function logAudit({ userId, action, entityType, entityId, metadata }) {
  await pool.query(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [userId, action, entityType, entityId ?? null, metadata ? JSON.stringify(metadata) : null]
  );
}
