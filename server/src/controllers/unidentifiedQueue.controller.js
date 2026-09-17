import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/unidentified-queue?status=pending
 */
export const listQueue = asyncHandler(async (req, res) => {
  const conditions = [];
  const values = [];
  if (req.query.status) {
    conditions.push('uq.status = ?');
    values.push(req.query.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT uq.*, si.crop_image_path, si.confidence_score, si.batch_id
     FROM unidentified_queue uq
     JOIN scan_items si ON si.id = uq.scan_item_id
     ${where}
     ORDER BY uq.created_at DESC`,
    values
  );

  // candidate_model_ids เก็บเป็น [{modelId, score}] — resolve ชื่อรุ่นให้ UI แสดงได้เลยไม่ต้อง join เอง
  const allCandidateIds = rows.flatMap((r) => (typeof r.candidate_model_ids === 'string' ? JSON.parse(r.candidate_model_ids) : r.candidate_model_ids ?? []).map((c) => c.modelId));
  const uniqueIds = [...new Set(allCandidateIds)];
  const modelMap = new Map();
  if (uniqueIds.length) {
    const [models] = await pool.query('SELECT id, brand, model_name, min_capacity_gb FROM phone_models WHERE id IN (?)', [uniqueIds]);
    models.forEach((m) => modelMap.set(m.id, m));
  }

  const items = rows.map((row) => {
    const candidates = (typeof row.candidate_model_ids === 'string' ? JSON.parse(row.candidate_model_ids) : row.candidate_model_ids ?? []).map(
      (c) => ({ ...c, model: modelMap.get(c.modelId) ?? null })
    );
    const extraImages = typeof row.extra_images === 'string' ? JSON.parse(row.extra_images) : row.extra_images ?? [];
    return { ...row, candidate_model_ids: candidates, extra_images: extraImages };
  });

  return res.json({ items });
});

async function findQueueItem(id) {
  const [rows] = await pool.query('SELECT * FROM unidentified_queue WHERE id = ?', [id]);
  return rows[0];
}

/**
 * POST /api/v1/unidentified-queue/:id/extra-images — ถ่ายเพิ่มหลายมุมสำหรับเครื่องที่ยังไม่รู้จัก
 * (ดู middleware/upload.js#uploadPhoneModelImages — reuse ตัวเดียวกัน แค่ปลายทางต่างกัน)
 */
export const addExtraImages = asyncHandler(async (req, res) => {
  const queueItem = await findQueueItem(req.params.id);
  if (!queueItem) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการนี้ในคิว');
  if (queueItem.status !== 'pending') {
    throw new AppError(400, 'VALIDATION_ERROR', 'รายการนี้ถูกจัดการไปแล้ว');
  }

  const existing = typeof queueItem.extra_images === 'string' ? JSON.parse(queueItem.extra_images) : queueItem.extra_images ?? [];
  const merged = [...existing, ...req.uploadedImageUrls];

  await pool.query('UPDATE unidentified_queue SET extra_images = ? WHERE id = ?', [
    JSON.stringify(merged),
    req.params.id,
  ]);

  return res.status(201).json({ extraImages: merged });
});

/**
 * PUT /api/v1/unidentified-queue/:id/resolve
 * body: { resolvedModelId } มอบให้รุ่นที่มีอยู่แล้ว, หรือ { newModel: {brand, modelName, minCapacityGb} }
 * สร้างรุ่นใหม่ — ทั้งสองแบบ crop_image_path (+ extra_images ถ้ามี) จะถูกเพิ่มเป็น reference image
 * ของรุ่นนั้นทันที (ระบบ "เรียนรู้" เพิ่ม — ยังไม่ embed จริงจนกว่าแอดมินจะกด "ประมวลผลใหม่")
 */
export const resolveQueue = asyncHandler(async (req, res) => {
  const queueItem = await findQueueItem(req.params.id);
  if (!queueItem) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการนี้ในคิว');
  if (queueItem.status !== 'pending') {
    throw new AppError(400, 'VALIDATION_ERROR', 'รายการนี้ถูกจัดการไปแล้ว');
  }

  const [itemRows] = await pool.query('SELECT * FROM scan_items WHERE id = ?', [queueItem.scan_item_id]);
  const scanItem = itemRows[0];

  let resolvedModelId = req.body.resolvedModelId;
  let resultStatus = 'resolved';
  let action = 'QUEUE_RESOLVED_EXISTING';

  if (req.body.newModel) {
    const { brand, modelName, minCapacityGb } = req.body.newModel;
    const [result] = await pool.query(
      'INSERT INTO phone_models (brand, model_name, min_capacity_gb) VALUES (?, ?, ?)',
      [brand, modelName, minCapacityGb]
    );
    resolvedModelId = result.insertId;
    resultStatus = 'new_model_created';
    action = 'QUEUE_NEW_MODEL_CREATED';
  } else {
    const [modelRows] = await pool.query('SELECT id FROM phone_models WHERE id = ? AND deleted_at IS NULL', [
      resolvedModelId,
    ]);
    if (!modelRows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรุ่นที่เลือก');
  }

  const extraImages = typeof queueItem.extra_images === 'string' ? JSON.parse(queueItem.extra_images) : queueItem.extra_images ?? [];
  const imagesToAdd = [scanItem.crop_image_path, ...extraImages];
  for (const imagePath of imagesToAdd) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query('INSERT INTO phone_model_images (model_id, image_path, uploaded_by) VALUES (?, ?, ?)', [
      resolvedModelId,
      imagePath,
      req.auth.userId,
    ]);
  }

  await pool.query('UPDATE scan_items SET matched_model_id = ?, status = ? WHERE id = ?', [
    resolvedModelId,
    'user_confirmed',
    scanItem.id,
  ]);

  await pool.query(
    'UPDATE unidentified_queue SET resolved_model_id = ?, status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
    [resolvedModelId, resultStatus, req.auth.userId, req.params.id]
  );

  await pool.query('INSERT INTO review_logs (unidentified_queue_id, admin_user_id, action, note) VALUES (?, ?, ?, ?)', [
    req.params.id,
    req.auth.userId,
    action,
    req.body.note ?? null,
  ]);

  await logAudit({
    userId: req.auth.userId,
    action,
    entityType: 'unidentified_queue',
    entityId: Number(req.params.id),
    metadata: { resolvedModelId, imagesAdded: imagesToAdd.length },
  });

  return res.json({
    status: resultStatus,
    resolvedModelId,
    imagesAdded: imagesToAdd.length,
    reindexNeeded: true,
  });
});

/**
 * PUT /api/v1/unidentified-queue/:id/reject — เครื่องนี้ไม่ใช่โทรศัพท์/ภาพเสีย ไม่นำเข้าฐานข้อมูล
 */
export const rejectQueue = asyncHandler(async (req, res) => {
  const queueItem = await findQueueItem(req.params.id);
  if (!queueItem) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการนี้ในคิว');
  if (queueItem.status !== 'pending') {
    throw new AppError(400, 'VALIDATION_ERROR', 'รายการนี้ถูกจัดการไปแล้ว');
  }

  await pool.query(
    'UPDATE unidentified_queue SET status = ?, resolved_at = NOW(), resolved_by = ? WHERE id = ?',
    ['resolved', req.auth.userId, req.params.id]
  );

  await pool.query('INSERT INTO review_logs (unidentified_queue_id, admin_user_id, action, note) VALUES (?, ?, ?, ?)', [
    req.params.id,
    req.auth.userId,
    'QUEUE_REJECTED',
    req.body.note ?? null,
  ]);

  await logAudit({
    userId: req.auth.userId,
    action: 'QUEUE_REJECTED',
    entityType: 'unidentified_queue',
    entityId: Number(req.params.id),
  });

  return res.status(204).send();
});
