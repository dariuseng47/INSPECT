import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/status-timeout-settings
 * admin(own tenant, บังคับ) / superadmin(ต้องระบุ ?hospitalId=) — ตาม docs/rbac-permissions.md
 * operator ไม่มีสิทธิ์เข้าถึง (❌ default ตายตัว ไม่ใช่ permission ที่ override ได้)
 */
export const listStatusTimeouts = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const tenantId = await resolveTenantId(req);
  const [rows] = await pool.query(
    'SELECT status, max_hours, updated_at FROM status_timeout_settings WHERE hospital_id = ? ORDER BY status',
    [tenantId]
  );

  return res.json({ settings: rows });
});

/**
 * PUT /api/v1/status-timeout-settings — แทนที่ทั้งชุด (delete แล้ว insert ใหม่ ตามแพทเทิร์นเดียวกับ cabinet par-levels)
 */
export const upsertStatusTimeouts = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const tenantId = await resolveTenantId(req);
  const { settings } = req.body;

  await pool.query('DELETE FROM status_timeout_settings WHERE hospital_id = ?', [tenantId]);

  for (const { status, maxHours } of settings) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      'INSERT INTO status_timeout_settings (hospital_id, status, max_hours) VALUES (?, ?, ?)',
      [tenantId, status, maxHours]
    );
  }

  const [rows] = await pool.query(
    'SELECT status, max_hours, updated_at FROM status_timeout_settings WHERE hospital_id = ? ORDER BY status',
    [tenantId]
  );

  return res.json({ settings: rows });
});
