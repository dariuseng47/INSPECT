import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mlDetect, mlEmbed, mlMatch } from '../utils/mlClient.js';
import { savePhoneScanFile } from '../middleware/upload.js';
import { cropRegion, drawAnnotations, buildColorMap, UNCERTAIN_COLOR } from '../utils/imageAnnotate.js';

// เกณฑ์ตัดสินใจ auto-match vs ไม่แน่ใจ — ค่าคร่าวๆ ตาม spec section 9 ต้องปรับจูนจริงจากข้อมูล
// การใช้งานจริง (ดู review_logs ที่เก็บไว้สำหรับย้อนดูภายหลัง)
const AUTO_MATCH_THRESHOLD = 0.75;
const AMBIGUOUS_MARGIN = 0.05; // top1 - top2 ใกล้กันน้อยกว่านี้ = ไม่แน่ใจ ถึงแม้ top1 จะสูงก็ตาม

function decideStatus(candidates) {
  if (!candidates.length) return { status: 'unidentified', matchedModelId: null, confidence: null };

  const [top, second] = candidates;
  const isHighConfidence = top.score >= AUTO_MATCH_THRESHOLD;
  const isAmbiguous = second && top.score - second.score < AMBIGUOUS_MARGIN;

  if (isHighConfidence && !isAmbiguous) {
    return { status: 'auto_matched', matchedModelId: top.modelId, confidence: top.score };
  }
  return { status: 'pending_review', matchedModelId: null, confidence: top.score };
}

async function modelsById(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const [rows] = await pool.query('SELECT * FROM phone_models WHERE id IN (?)', [uniqueIds]);
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * POST /api/v1/scans — อัพภาพวางเรียงบนโต๊ะ/ถาด (หลายเครื่องในภาพเดียวได้)
 * flow: detect ตำแหน่งโทรศัพท์ทั้งหมด -> ตัด crop ทีละเครื่อง -> embed -> match -> ตัดสินสถานะ
 *       -> วาดภาพผลลัพธ์ (ตีกรอบสีตามรุ่น) -> บันทึกลง DB -> เครื่องที่ไม่แน่ใจเข้าคิวตรวจสอบ
 */
export const createScan = asyncHandler(async (req, res) => {
  const originalBuffer = req.file.buffer;
  const originalUrl = await savePhoneScanFile(originalBuffer, '.jpg');

  const detections = await mlDetect(originalBuffer);

  const items = [];
  for (const box of detections) {
    // eslint-disable-next-line no-await-in-loop
    const cropBuffer = await cropRegion(originalBuffer, box);
    // eslint-disable-next-line no-await-in-loop
    const embedding = await mlEmbed(cropBuffer);
    // eslint-disable-next-line no-await-in-loop
    const candidates = await mlMatch(embedding, 3);
    // eslint-disable-next-line no-await-in-loop
    const cropUrl = await savePhoneScanFile(cropBuffer, '.jpg');

    const decision = decideStatus(candidates);
    items.push({ box, candidates, cropUrl, ...decision });
  }

  const matchedModels = await modelsById(items.map((i) => i.matchedModelId));
  const colorMap = buildColorMap(items.map((i) => i.matchedModelId));

  const annotatedDetections = items.map((item) => {
    const model = matchedModels.get(item.matchedModelId);
    const color = model ? colorMap.get(item.matchedModelId) : UNCERTAIN_COLOR;
    const label = model
      ? `${model.brand} ${model.model_name} (${Math.round(item.confidence * 100)}%)`
      : item.status === 'unidentified'
        ? 'ไม่รู้จัก'
        : 'ไม่แน่ใจ';
    return { ...item.box, color, label };
  });

  const annotatedBuffer = await drawAnnotations(originalBuffer, annotatedDetections);
  const annotatedUrl = await savePhoneScanFile(annotatedBuffer, '.png');

  const [batchResult] = await pool.query(
    `INSERT INTO scan_batches (user_id, source, original_image_path, annotated_image_path, device_count)
     VALUES (?, 'web', ?, ?, ?)`,
    [req.auth.userId, originalUrl, annotatedUrl, items.length]
  );
  const batchId = batchResult.insertId;

  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const [itemResult] = await pool.query(
      `INSERT INTO scan_items (batch_id, bbox_x, bbox_y, bbox_w, bbox_h, crop_image_path,
                                matched_model_id, confidence_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        item.box.x,
        item.box.y,
        item.box.w,
        item.box.h,
        item.cropUrl,
        item.matchedModelId,
        item.confidence,
        item.status,
      ]
    );

    if (item.status === 'unidentified' || item.status === 'pending_review') {
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        'INSERT INTO unidentified_queue (scan_item_id, candidate_model_ids) VALUES (?, ?)',
        [itemResult.insertId, JSON.stringify(item.candidates)]
      );
    }
  }

  await logAudit({
    userId: req.auth.userId,
    action: 'PHONE_SCAN_CREATED',
    entityType: 'scan_batch',
    entityId: batchId,
    metadata: { deviceCount: items.length },
  });

  return res.status(201).json(await buildBatchResponse(batchId));
});

async function buildBatchResponse(batchId) {
  const [batchRows] = await pool.query('SELECT * FROM scan_batches WHERE id = ?', [batchId]);
  const batch = batchRows[0];

  const [itemRows] = await pool.query(
    `SELECT si.*, pm.brand, pm.model_name, pm.min_capacity_gb
     FROM scan_items si
     LEFT JOIN phone_models pm ON pm.id = si.matched_model_id
     WHERE si.batch_id = ?
     ORDER BY si.id`,
    [batchId]
  );

  const byCapacity = new Map();
  let uncertainCount = 0;
  for (const item of itemRows) {
    if (item.status === 'unidentified' || item.status === 'pending_review') {
      uncertainCount += 1;
      continue;
    }
    const key = item.min_capacity_gb;
    byCapacity.set(key, (byCapacity.get(key) ?? 0) + 1);
  }

  const summary = {
    totalDevices: itemRows.length,
    uncertainCount,
    byCapacity: [...byCapacity.entries()]
      .map(([capacityGb, count]) => ({ capacityGb, count }))
      .sort((a, b) => a.capacityGb - b.capacityGb),
  };

  return { batch, items: itemRows, summary };
}

/**
 * GET /api/v1/scans
 */
export const listScanBatches = asyncHandler(async (req, res) => {
  const limit = req.query.limit ?? 50;
  const [rows] = await pool.query(
    `SELECT sb.*, u.full_name AS user_full_name
     FROM scan_batches sb
     LEFT JOIN users u ON u.id = sb.user_id
     ORDER BY sb.created_at DESC LIMIT ?`,
    [limit]
  );
  return res.json({ batches: rows });
});

/**
 * GET /api/v1/scans/:id
 */
export const getScanBatch = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT id FROM scan_batches WHERE id = ?', [req.params.id]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรอบสแกนนี้');
  return res.json(await buildBatchResponse(req.params.id));
});
