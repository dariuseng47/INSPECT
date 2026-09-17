import fs from 'node:fs/promises';
import path from 'node:path';

import { pool } from '../db/pool.js';
import { mlReindex } from '../utils/mlClient.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UPLOAD_ROOT, unlinkUploadedImage } from '../middleware/upload.js';

// เกณฑ์คร่าวๆ ว่าภาพอ้างอิงของรุ่นนี้ "พอ" ให้ ML-Service แยกแยะได้แม่นยำหรือยัง — ปรับได้ภายหลัง
// จากข้อมูลจริง (ดู spec section 10: ต้องมีภาพหลากสี/สภาพต่อรุ่น)
function sufficiencyOf(imageCount) {
  if (imageCount >= 8) return { level: 'good', label: 'เพียงพอ' };
  if (imageCount >= 3) return { level: 'medium', label: 'พอใช้ได้ — ควรเพิ่มอีก' };
  return { level: 'low', label: 'ยังน้อยเกินไป' };
}

export const SUFFICIENCY_ADVICE =
  'แนะนำอย่างน้อย 8 ภาพต่อรุ่น ครอบคลุมหลายมุม (หน้า/หลัง/ข้าง), หลายสี, และสภาพเครื่องที่พบได้จริง ' +
  '(มีเคส/รอยขีดข่วน) ถ่ายด้วยแสงปกติคล้ายกับที่จะใช้ตอนสแกนจริง';

async function attachImageStats(models) {
  if (models.length === 0) return models;
  const ids = models.map((m) => m.id);
  const [rows] = await pool.query(
    `SELECT model_id, COUNT(*) AS total, SUM(embedded_at IS NOT NULL) AS embedded
     FROM phone_model_images WHERE model_id IN (?) AND is_active = 1 GROUP BY model_id`,
    [ids]
  );
  const statsByModel = new Map(rows.map((r) => [r.model_id, r]));
  return models.map((m) => {
    const stats = statsByModel.get(m.id);
    const imageCount = Number(stats?.total ?? 0);
    return {
      ...m,
      imageCount,
      embeddedCount: Number(stats?.embedded ?? 0),
      sufficiency: sufficiencyOf(imageCount),
    };
  });
}

/**
 * GET /api/v1/phone-models
 */
export const listPhoneModels = asyncHandler(async (req, res) => {
  const conditions = ['deleted_at IS NULL'];
  const values = [];
  if (req.query.brand) {
    conditions.push('brand = ?');
    values.push(req.query.brand);
  }
  if (req.query.search) {
    conditions.push('(brand LIKE ? OR model_name LIKE ?)');
    values.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }

  const [rows] = await pool.query(
    `SELECT * FROM phone_models WHERE ${conditions.join(' AND ')} ORDER BY brand, model_name`,
    values
  );

  return res.json({ models: await attachImageStats(rows), advice: SUFFICIENCY_ADVICE });
});

/**
 * GET /api/v1/phone-models/:id
 */
export const getPhoneModel = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM phone_models WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  const model = rows[0];
  if (!model) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรุ่นโทรศัพท์นี้');

  const [images] = await pool.query(
    'SELECT * FROM phone_model_images WHERE model_id = ? AND is_active = 1 ORDER BY uploaded_at DESC',
    [req.params.id]
  );

  const [withStats] = await attachImageStats([model]);

  return res.json({ model: withStats, images, advice: SUFFICIENCY_ADVICE });
});

/**
 * POST /api/v1/phone-models
 */
export const createPhoneModel = asyncHandler(async (req, res) => {
  const { brand, modelName, minCapacityGb } = req.body;

  const [existing] = await pool.query('SELECT id FROM phone_models WHERE brand = ? AND model_name = ? AND deleted_at IS NULL', [
    brand,
    modelName,
  ]);
  if (existing[0]) {
    throw new AppError(409, 'MODEL_EXISTS', 'มีรุ่นนี้ในระบบอยู่แล้ว');
  }

  const [result] = await pool.query(
    'INSERT INTO phone_models (brand, model_name, min_capacity_gb) VALUES (?, ?, ?)',
    [brand, modelName, minCapacityGb]
  );

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODEL_CREATED',
    entityType: 'phone_model',
    entityId: result.insertId,
    metadata: { brand, modelName, minCapacityGb },
  });

  const [rows] = await pool.query('SELECT * FROM phone_models WHERE id = ?', [result.insertId]);
  return res.status(201).json({ model: rows[0] });
});

/**
 * PATCH /api/v1/phone-models/:id
 */
export const updatePhoneModel = asyncHandler(async (req, res) => {
  const [existingRows] = await pool.query('SELECT * FROM phone_models WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  const existing = existingRows[0];
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรุ่นโทรศัพท์นี้');

  const { brand, modelName, minCapacityGb, coverImageId } = req.body;
  const updates = [];
  const values = [];

  if (brand !== undefined) {
    updates.push('brand = ?');
    values.push(brand);
  }
  if (modelName !== undefined) {
    updates.push('model_name = ?');
    values.push(modelName);
  }
  if (minCapacityGb !== undefined) {
    updates.push('min_capacity_gb = ?');
    values.push(minCapacityGb);
  }
  if (coverImageId !== undefined) {
    const [imgRows] = await pool.query('SELECT image_path FROM phone_model_images WHERE id = ? AND model_id = ?', [
      coverImageId,
      req.params.id,
    ]);
    if (!imgRows[0]) throw new AppError(400, 'VALIDATION_ERROR', 'ภาพนี้ไม่ได้อยู่ในรุ่นนี้');
    updates.push('cover_image_path = ?');
    values.push(imgRows[0].image_path);
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await pool.query(`UPDATE phone_models SET ${updates.join(', ')} WHERE id = ?`, [
    ...values,
    req.params.id,
  ]);

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODEL_UPDATED',
    entityType: 'phone_model',
    entityId: Number(req.params.id),
    metadata: { brand, modelName, minCapacityGb, coverImageId },
  });

  const [rows] = await pool.query('SELECT * FROM phone_models WHERE id = ?', [req.params.id]);
  return res.json({ model: rows[0] });
});

/**
 * DELETE /api/v1/phone-models/:id — soft delete (ประวัติสแกนเก่ายังอ้างอิง matched_model_id ได้)
 */
export const deletePhoneModel = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id FROM phone_models WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรุ่นโทรศัพท์นี้');

  await pool.query('UPDATE phone_models SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
  await pool.query('UPDATE phone_model_images SET is_active = 0 WHERE model_id = ?', [req.params.id]);

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODEL_DELETED',
    entityType: 'phone_model',
    entityId: Number(req.params.id),
  });

  return res.status(204).send();
});

/**
 * POST /api/v1/phone-models/:id/images — อัพหลายภาพพร้อมกัน (ดู middleware/upload.js#uploadPhoneModelImages)
 * ยังไม่ embed ทันที — รอแอดมินกดปุ่ม "ประมวลผลใหม่" (POST /phone-models/reindex) เป็นรอบๆ
 */
export const uploadImages = asyncHandler(async (req, res) => {
  const [modelRows] = await pool.query('SELECT id FROM phone_models WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  if (!modelRows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรุ่นโทรศัพท์นี้');

  const insertedIds = [];
  for (const imageUrl of req.uploadedImageUrls) {
    // eslint-disable-next-line no-await-in-loop
    const [result] = await pool.query(
      'INSERT INTO phone_model_images (model_id, image_path, uploaded_by) VALUES (?, ?, ?)',
      [req.params.id, imageUrl, req.auth.userId]
    );
    insertedIds.push(result.insertId);
  }

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODEL_IMAGES_UPLOADED',
    entityType: 'phone_model',
    entityId: Number(req.params.id),
    metadata: { count: insertedIds.length },
  });

  const [images] = await pool.query('SELECT * FROM phone_model_images WHERE id IN (?)', [insertedIds]);
  return res.status(201).json({ images });
});

/**
 * DELETE /api/v1/phone-models/:id/images/:imageId — ลบทั้งไฟล์บน disk และแถวใน DB
 */
export const deleteImage = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM phone_model_images WHERE id = ? AND model_id = ?', [
    req.params.imageId,
    req.params.id,
  ]);
  const image = rows[0];
  if (!image) throw new AppError(404, 'NOT_FOUND', 'ไม่พบภาพนี้');

  await pool.query('DELETE FROM phone_model_images WHERE id = ?', [req.params.imageId]);
  unlinkUploadedImage(image.image_path);

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODEL_IMAGE_DELETED',
    entityType: 'phone_model_image',
    entityId: Number(req.params.imageId),
    metadata: { modelId: Number(req.params.id) },
  });

  return res.status(204).send();
});

/**
 * POST /api/v1/phone-models/reindex
 * อ่านภาพอ้างอิง active ทั้งหมดจากทุกรุ่น (ที่ยังไม่ถูกลบ) ส่งให้ ML-Service คำนวณ embedding ใหม่
 * ทั้งชุด แล้ว rebuild index — เร็วเพราะไม่ได้ train โมเดล แค่คำนวณ vector ใหม่ (ดู spec section 5)
 */
export const reindexAll = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT pmi.id, pmi.model_id, pmi.image_path
     FROM phone_model_images pmi
     JOIN phone_models pm ON pm.id = pmi.model_id
     WHERE pmi.is_active = 1 AND pm.deleted_at IS NULL`
  );

  const entries = [];
  const readFailures = [];
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const buffer = await fs.readFile(path.join(UPLOAD_ROOT, row.image_path.replace(/^\/uploads\//, '')));
      entries.push({ imageId: row.id, modelId: row.model_id, imageBase64: buffer.toString('base64') });
    } catch {
      readFailures.push(row.id);
    }
  }

  const result = await mlReindex(entries);

  if (result.indexed > 0) {
    const indexedIds = entries.map((e) => e.imageId);
    await pool.query('UPDATE phone_model_images SET embedded_at = NOW() WHERE id IN (?)', [indexedIds]);
  }

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_MODELS_REINDEXED',
    entityType: 'phone_model_images',
    metadata: { indexed: result.indexed, failed: result.failed, readFailures },
  });

  return res.json({ ...result, readFailures });
});
