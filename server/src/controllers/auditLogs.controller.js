import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const DEFAULT_LIMIT = 100;

/**
 * GET /api/v1/audit-logs
 * superadmin: เห็นทุก tenant (filter ?hospitalId= ได้) / admin: เห็นเฉพาะ tenant ตัวเอง (บังคับ)
 * operator: ไม่มีสิทธิ์เข้าถึงเลย — ดู docs/api-spec.md, docs/rbac-permissions.md
 */
export const listAuditLogs = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const conditions = [];
  const values = [];

  if (req.auth.role === 'ADMIN') {
    conditions.push('al.hospital_id = ?');
    values.push(req.auth.hospitalId);
  } else if (req.query.hospitalId) {
    conditions.push('al.hospital_id = ?');
    values.push(req.query.hospitalId);
  }

  if (req.query.action) {
    conditions.push('al.action = ?');
    values.push(req.query.action);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = req.query.limit ?? DEFAULT_LIMIT;

  const [rows] = await pool.query(
    `SELECT al.id, al.hospital_id, al.user_id, al.action, al.entity_type, al.entity_id,
            al.metadata, al.created_at,
            u.username, u.full_name AS user_full_name,
            h.name AS hospital_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     LEFT JOIN hospitals h ON h.id = al.hospital_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [...values, limit]
  );

  return res.json({ auditLogs: rows });
});
