import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const DEFAULT_LIMIT = 100;

/**
 * GET /api/v1/audit-logs
 * superadmin/admin เท่านั้น — operator ไม่มีสิทธิ์เข้าถึงเลย
 */
export const listAuditLogs = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const conditions = [];
  const values = [];

  if (req.query.action) {
    conditions.push('al.action = ?');
    values.push(req.query.action);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = req.query.limit ?? DEFAULT_LIMIT;

  const [rows] = await pool.query(
    `SELECT al.id, al.user_id, al.action, al.entity_type, al.entity_id,
            al.metadata, al.created_at,
            u.username, u.full_name AS user_full_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [...values, limit]
  );

  return res.json({ auditLogs: rows });
});
