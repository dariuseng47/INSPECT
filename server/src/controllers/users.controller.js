import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { hashPin } from '../utils/pin.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { isOnline } from '../sockets/presence.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * GET /api/v1/users
 * superadmin: เห็นทุกคน / admin: เห็นเฉพาะตัวเอง + operator ที่ตัวเองสร้าง (managed_by)
 */
export const listUsers = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const conditions = ['deleted_at IS NULL'];
  const values = [];

  if (req.auth.role === 'ADMIN') {
    conditions.push('(id = ? OR managed_by = ?)');
    values.push(req.auth.userId, req.auth.userId);
  }

  if (req.query.role) {
    const roles = req.query.role
      .split(',')
      .map((role) => role.trim().toUpperCase())
      .filter((role) => ['SUPERADMIN', 'ADMIN', 'OPERATOR'].includes(role));
    if (roles.length > 0) {
      conditions.push('role IN (?)');
      values.push(roles);
    }
  }

  const [rows] = await pool.query(
    `SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
    values
  );

  // isOnline มาจาก in-memory socket presence (server/src/sockets/presence.js) ไม่ใช่คอลัมน์ DB
  const users = rows.map((row) => ({ ...sanitizeUser(row), isOnline: isOnline(row.id) }));

  return res.json({ users });
});

// โหลดธง delegation ของ actor (แอดมิน) — can_manage_subordinates / handheld_enabled
async function loadActorFlags(userId) {
  const [rows] = await pool.query(
    'SELECT can_manage_subordinates, handheld_enabled FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return {
    canManageSubordinates: !!rows[0]?.can_manage_subordinates,
    handheldEnabled: !!rows[0]?.handheld_enabled,
  };
}

/**
 * POST /api/v1/users
 * - superadmin สร้างได้ทุก role (SUPERADMIN/ADMIN/OPERATOR) + ตั้ง handheldEnabled /
 *   canManageSubordinates ได้
 * - admin สร้างได้เฉพาะ OPERATOR และต่อเมื่อ can_manage_subordinates ของตัวเอง = true
 *   (operator ที่สร้างจะถูกผูก managed_by = admin คนนี้)
 */
export const createUser = asyncHandler(async (req, res) => {
  const { username, password, pin, fullName, phone, role } = req.body;

  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์สร้างบัญชีผู้ใช้');
  }

  let handheldEnabled = req.body.handheldEnabled !== false; // default: true
  let canManageSubordinates = role === 'ADMIN' ? req.body.canManageSubordinates !== false : false;

  if (req.auth.role === 'SUPERADMIN') {
    if (role === 'SUPERADMIN') {
      canManageSubordinates = false;
    }
  } else {
    // ADMIN
    if (role !== 'OPERATOR') {
      throw new AppError(403, 'FORBIDDEN', 'admin สร้างได้เฉพาะบัญชี operator เท่านั้น');
    }
    const flags = await loadActorFlags(req.auth.userId);
    if (!flags.canManageSubordinates) {
      throw new AppError(403, 'FORBIDDEN', 'บัญชีของคุณไม่ได้รับอนุญาตให้สร้าง/จัดการพนักงาน');
    }
    canManageSubordinates = false; // operator ไม่มีลูกน้อง
    if (!flags.handheldEnabled) handheldEnabled = false; // มอบเกินตัวเองไม่ได้
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [
    username,
  ]);
  if (existing[0]) {
    throw new AppError(409, 'USERNAME_TAKEN', 'ชื่อผู้ใช้นี้มีคนใช้แล้ว');
  }

  const pinHash = hashPin(pin);
  const [existingPin] = await pool.query('SELECT id FROM users WHERE pin_hash = ? LIMIT 1', [
    pinHash,
  ]);
  if (existingPin[0]) {
    throw new AppError(409, 'PIN_TAKEN', 'PIN นี้ถูกใช้แล้ว กรุณาเลือก PIN อื่น');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [result] = await pool.query(
    `INSERT INTO users
       (role, managed_by, username, password_hash, pin_hash, full_name, phone,
        is_active, handheld_enabled, can_manage_subordinates)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)`,
    [
      role,
      req.auth.userId,
      username,
      passwordHash,
      pinHash,
      fullName,
      phone ?? null,
      handheldEnabled ? 1 : 0,
      canManageSubordinates ? 1 : 0,
    ]
  );

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

  await logAudit({
    userId: req.auth.userId,
    action: 'USER_CREATED',
    entityType: 'user',
    entityId: result.insertId,
    metadata: { username, role, handheldEnabled, canManageSubordinates },
  });

  return res.status(201).json({ user: sanitizeUser(rows[0]) });
});

export async function findTargetUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
    id,
  ]);
  return rows[0];
}

// hard-coded boundary — ห้าม override เด็ดขาด (ใช้ร่วมกับ permissions.controller.js ด้วย
// เพราะกฎ "ใครจัดการใครได้" เหมือนกันทุกประตู)
export async function assertCanManage(actingAuth, targetUser) {
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้งานนี้');
  }
  if (actingAuth.role === 'SUPERADMIN') return;

  if (actingAuth.role === 'ADMIN') {
    if (targetUser.role !== 'OPERATOR' || targetUser.managed_by !== actingAuth.userId) {
      throw new AppError(403, 'FORBIDDEN', 'admin จัดการได้เฉพาะบัญชี operator ที่ตัวเองสร้างเท่านั้น');
    }
    return;
  }

  throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์จัดการบัญชีผู้ใช้');
}

/**
 * PATCH /api/v1/users/:id
 */
export const updateUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  const { fullName, phone, isActive, handheldEnabled, canManageSubordinates } = req.body;
  const updates = [];
  const values = [];
  if (fullName !== undefined) {
    updates.push('full_name = ?');
    values.push(fullName);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive);
  }
  if (handheldEnabled !== undefined) {
    // แอดมินมอบสิทธิ์ handheld ให้พนักงานได้ไม่เกินตัวเอง
    if (req.auth.role === 'ADMIN' && handheldEnabled) {
      const flags = await loadActorFlags(req.auth.userId);
      if (!flags.handheldEnabled) {
        throw new AppError(403, 'FORBIDDEN', 'บัญชีของคุณเองไม่มีสิทธิ์ใช้เครื่องพกพา จึงมอบให้ผู้อื่นไม่ได้');
      }
    }
    updates.push('handheld_enabled = ?');
    values.push(handheldEnabled ? 1 : 0);
  }
  if (canManageSubordinates !== undefined) {
    // เฉพาะ superadmin เท่านั้นที่ตั้ง "แอดมินคนนี้สร้างพนักงานได้ไหม"
    if (req.auth.role !== 'SUPERADMIN') {
      throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin ที่ตั้งค่าสิทธิ์สร้างพนักงานของแอดมินได้');
    }
    if (targetUser.role !== 'ADMIN') {
      throw new AppError(400, 'VALIDATION_ERROR', 'ตั้งค่านี้ได้เฉพาะบัญชี admin');
    }
    updates.push('can_manage_subordinates = ?');
    values.push(canManageSubordinates ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [
    ...values,
    req.params.id,
  ]);

  await logAudit({
    userId: req.auth.userId,
    action: 'USER_UPDATED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: { fullName, phone, isActive, handheldEnabled, canManageSubordinates },
  });

  return res.status(204).send();
});

/**
 * DELETE /api/v1/users/:id — soft delete
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  await assertCanManage(req.auth, targetUser);

  await pool.query('UPDATE users SET deleted_at = NOW(), is_active = FALSE WHERE id = ?', [
    req.params.id,
  ]);

  await logAudit({
    userId: req.auth.userId,
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: targetUser.id,
    metadata: { username: targetUser.username },
  });

  return res.status(204).send();
});
