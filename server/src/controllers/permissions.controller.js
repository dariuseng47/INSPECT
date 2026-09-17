import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getUserScopeRows } from '../utils/userScopes.js';
import { findTargetUser, assertCanManage } from './users.controller.js';
import {
  hasPermission,
  isKnownPermissionKey,
  incrementPermVersion,
  getEffectivePermissions,
} from '../utils/permissions.js';

/**
 * GET /api/v1/users/me/permissions — ดูสิทธิ์ effective ของตัวเอง (ไม่ผ่าน assertCanManage
 * เพราะ endpoint /:id/permissions เดิมใช้ดูสิทธิ์ตัวเองไม่ได้ — assertCanManage บล็อก ADMIN ที่
 * target เป็น ADMIN เอง แต่ดูสิทธิ์ตัวเองย่อมทำได้เสมอไม่ว่า role ไหน)
 */
export const getMyPermissions = asyncHandler(async (req, res) => {
  const permissions = await getEffectivePermissions(req.auth.userId, req.auth.role);
  return res.json({ permissions });
});

/**
 * GET /api/v1/users/:id/permissions
 * คืน effective permissions + scope โรงพยาบาล + ธง handheld/สร้างพนักงาน ของ target ให้ครบ
 * เพื่อให้หน้าจอตั้งค่าสิทธิ์ (PermissionEditorDialog) แสดงได้ในที่เดียว
 */
export const getUserPermissions = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  const [permissions, scopes] = await Promise.all([
    getEffectivePermissions(targetUser.id, targetUser.role),
    getUserScopeRows(targetUser.id),
  ]);

  return res.json({
    permissions,
    scopes,
    handheldEnabled: !!targetUser.handheld_enabled,
    canManageSubordinates: !!targetUser.can_manage_subordinates,
  });
});

/**
 * PUT /api/v1/users/:id/permissions
 * body: { overrides: [{ permKey, effect: 'GRANT'|'DENY'|null }] } — effect null = ลบ override
 * นั้นออก กลับไปใช้ default ของ role ตามปกติ
 *
 * กฎ delegation ตาม docs/rbac-permissions.md:
 * - assertCanManage() บล็อก admin ที่พยายามแก้ record ของ admin/superadmin คนอื่นไปแล้ว
 *   (และบล็อก operator ไม่ให้เรียก endpoint นี้ได้เลย) ก่อนถึงโค้ดส่วนนี้
 * - ผู้มอบสิทธิ์ (grantor) ต้องมี perm_key นั้น effective = true อยู่แล้วจริง ถึงจะ GRANT ให้คนอื่นได้
 *   ป้องกัน privilege escalation ผ่านการ delegate (superadmin effective ทุก perm อยู่แล้วข้ามเช็คนี้ได้)
 * - override ที่ superadmin ตั้งไว้ (superadmin_locked = 1) แอดมินของโรงพยาบาลแก้/ลบทับไม่ได้
 * - เมื่อ superadmin แก้ override ใดๆ จะตั้ง superadmin_locked = 1 ให้อัตโนมัติ
 */
export const updateUserPermissions = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  const { overrides } = req.body;
  const isSuperadmin = req.auth.role === 'SUPERADMIN';

  // โหลด lock state ปัจจุบันของ target ไว้ก่อน — ใช้กันแอดมินแก้ทับ
  const [lockRows] = await pool.query(
    'SELECT perm_key, superadmin_locked FROM user_permission_overrides WHERE user_id = ?',
    [targetUser.id]
  );
  const lockedKeys = new Set(
    lockRows.filter((r) => r.superadmin_locked).map((r) => r.perm_key)
  );

  for (const { permKey, effect } of overrides) {
    if (!isKnownPermissionKey(permKey)) {
      throw new AppError(400, 'VALIDATION_ERROR', `ไม่รู้จัก permission: ${permKey}`);
    }

    if (!isSuperadmin && lockedKeys.has(permKey)) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'สิทธิ์นี้ถูกตั้งค่าโดยผู้ดูแลระบบส่วนกลาง (superadmin) — แก้ไขไม่ได้'
      );
    }

    if (!isSuperadmin && effect === 'GRANT') {
      const grantorHasIt = await hasPermission(req.auth.userId, req.auth.role, permKey);
      if (!grantorHasIt) {
        throw new AppError(
          403,
          'FORBIDDEN',
          `ไม่สามารถมอบสิทธิ์นี้ให้ผู้อื่นได้ เพราะตัวคุณเองไม่มีสิทธิ์นี้อยู่ก่อนแล้ว`
        );
      }
    }

    if (effect === null) {
      await pool.query(
        'DELETE FROM user_permission_overrides WHERE user_id = ? AND perm_key = ?',
        [targetUser.id, permKey]
      );
    } else {
      await pool.query(
        `INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by, superadmin_locked)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           effect = VALUES(effect),
           granted_by = VALUES(granted_by),
           superadmin_locked = VALUES(superadmin_locked)`,
        [targetUser.id, permKey, effect, req.auth.userId, isSuperadmin ? 1 : 0]
      );
    }
  }

  await incrementPermVersion(targetUser.id);

  await logAudit({
    hospitalId: targetUser.hospital_id,
    userId: req.auth.userId,
    action: 'PERMISSION_UPDATED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: { overrides, by: isSuperadmin ? 'superadmin' : 'admin' },
  });

  const permissions = await getEffectivePermissions(targetUser.id, targetUser.role);
  return res.json({ permissions });
});
