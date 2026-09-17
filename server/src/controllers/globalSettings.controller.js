import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getGlobalSettings } from '../utils/globalSettings.js';

// hard-coded boundary ตาม docs/rbac-permissions.md — admin/operator "มองไม่เห็นเมนูนี้เลย"
// เป็น security boundary ของระบบ ไม่ใช่ permission ที่ override ได้ผ่าน user_permission_overrides
function assertSuperadmin(auth) {
  if (auth.role !== 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin เท่านั้นที่เข้าถึงส่วนนี้ได้');
  }
}

/**
 * GET /api/v1/global-settings
 */
export const getSettings = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);
  const settings = await getGlobalSettings();
  return res.json({ settings });
});

/**
 * PUT /api/v1/global-settings
 */
export const updateSettings = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const { defaultRssiThresholdDbm, defaultParLevelWarningPct } = req.body;
  const updates = [];
  const values = [];
  if (defaultRssiThresholdDbm !== undefined) {
    updates.push('default_rssi_threshold_dbm = ?');
    values.push(defaultRssiThresholdDbm);
  }
  if (defaultParLevelWarningPct !== undefined) {
    updates.push('default_par_level_warning_pct = ?');
    values.push(defaultParLevelWarningPct);
  }
  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  updates.push('updated_by = ?');
  values.push(req.auth.userId);

  await pool.query(`UPDATE global_settings SET ${updates.join(', ')} WHERE id = 1`, values);

  await logAudit({
    hospitalId: null,
    userId: req.auth.userId,
    action: 'GLOBAL_SETTINGS_UPDATED',
    entityType: 'global_settings',
    entityId: 1,
    metadata: { defaultRssiThresholdDbm, defaultParLevelWarningPct },
  });

  const settings = await getGlobalSettings();
  return res.json({ settings });
});
