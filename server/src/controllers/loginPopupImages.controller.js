import fs from 'node:fs';
import path from 'node:path';

import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';

// hard-coded boundary เหมือน globalSettings.controller.js — admin/operator มองไม่เห็นเมนูนี้เลย
function assertSuperadmin(auth) {
  if (auth.role !== 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin เท่านั้นที่เข้าถึงส่วนนี้ได้');
  }
}

function mapRow(row) {
  return {
    ...row,
    roles: typeof row.roles === 'string' ? JSON.parse(row.roles) : row.roles,
    is_active: !!row.is_active,
  };
}

function unlinkUploadedFile(imageUrl) {
  if (!imageUrl) return;
  // imageUrl เก็บเป็น '/uploads/login-popup-images/xxx.ext' — UPLOAD_ROOT คือโฟลเดอร์ 'uploads' เอง
  const filePath = path.join(UPLOAD_ROOT, imageUrl.replace(/^\/uploads\//, ''));
  fs.unlink(filePath, () => {}); // ไฟล์ไม่มีอยู่แล้วก็ไม่ใช่ error ที่ต้อง block response
}

/**
 * GET /api/v1/login-popup-images — รายการทั้งหมด (superadmin จัดการ)
 */
export const listAll = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);
  const [rows] = await pool.query('SELECT * FROM login_popup_images ORDER BY sort_order, id');
  return res.json({ images: rows.map(mapRow) });
});

/**
 * GET /api/v1/login-popup-images/for-me — รูปที่ role ของผู้ใช้ปัจจุบันเห็นได้ (popup หลัง login)
 */
export const listForMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM login_popup_images WHERE is_active = 1 AND JSON_CONTAINS(roles, JSON_QUOTE(?)) ORDER BY sort_order, id',
    [req.auth.role]
  );
  return res.json({ images: rows.map(mapRow) });
});

/**
 * POST /api/v1/login-popup-images
 */
export const create = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const { imageUrl, roles, sortOrder, isActive } = req.body;

  const [result] = await pool.query(
    'INSERT INTO login_popup_images (image_url, roles, sort_order, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
    [imageUrl, JSON.stringify(roles), sortOrder, isActive ? 1 : 0, req.auth.userId]
  );

  await logAudit({
    hospitalId: null,
    userId: req.auth.userId,
    action: 'LOGIN_POPUP_IMAGE_CREATED',
    entityType: 'login_popup_images',
    entityId: result.insertId,
    metadata: { roles, sortOrder, isActive },
  });

  const [rows] = await pool.query('SELECT * FROM login_popup_images WHERE id = ?', [result.insertId]);
  return res.status(201).json({ image: mapRow(rows[0]) });
});

/**
 * PATCH /api/v1/login-popup-images/:id
 */
export const update = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const [existingRows] = await pool.query('SELECT * FROM login_popup_images WHERE id = ?', [
    req.params.id,
  ]);
  const existing = existingRows[0];
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบรูปภาพนี้');
  }

  const { imageUrl, roles, sortOrder, isActive } = req.body;
  const updates = [];
  const values = [];

  if (imageUrl !== undefined) {
    updates.push('image_url = ?');
    values.push(imageUrl);
  }
  if (roles !== undefined) {
    updates.push('roles = ?');
    values.push(JSON.stringify(roles));
  }
  if (sortOrder !== undefined) {
    updates.push('sort_order = ?');
    values.push(sortOrder);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  values.push(req.params.id);
  await pool.query(`UPDATE login_popup_images SET ${updates.join(', ')} WHERE id = ?`, values);

  // แทนที่รูปเดิมด้วยรูปใหม่แล้ว ค่อยลบไฟล์เก่าทิ้งหลัง update สำเร็จ
  if (imageUrl !== undefined && imageUrl !== existing.image_url) {
    unlinkUploadedFile(existing.image_url);
  }

  await logAudit({
    hospitalId: null,
    userId: req.auth.userId,
    action: 'LOGIN_POPUP_IMAGE_UPDATED',
    entityType: 'login_popup_images',
    entityId: Number(req.params.id),
    metadata: { roles, sortOrder, isActive },
  });

  const [rows] = await pool.query('SELECT * FROM login_popup_images WHERE id = ?', [req.params.id]);
  return res.json({ image: mapRow(rows[0]) });
});

/**
 * DELETE /api/v1/login-popup-images/:id
 */
export const remove = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const [rows] = await pool.query('SELECT * FROM login_popup_images WHERE id = ?', [req.params.id]);
  const existing = rows[0];
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบรูปภาพนี้');
  }

  await pool.query('DELETE FROM login_popup_images WHERE id = ?', [req.params.id]);
  unlinkUploadedFile(existing.image_url);

  await logAudit({
    hospitalId: null,
    userId: req.auth.userId,
    action: 'LOGIN_POPUP_IMAGE_DELETED',
    entityType: 'login_popup_images',
    entityId: Number(req.params.id),
  });

  return res.status(204).send();
});
