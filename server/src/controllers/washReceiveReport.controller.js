import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// รายงาน "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" — สร้างจาก wash_receive_batches + scan_logs
// (event_type='WASH_RECEIVE') ที่ scans.controller.js#washReceiveBatch บันทึกไว้ทุกครั้งที่สแกน+ชั่ง 1 ชุด

function buildDateRange(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  return { from: startDate || today, to: endDate || today };
}

async function fetchBatches(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT b.id, b.weight_kg, b.item_count, b.created_at, u.full_name AS user_name
     FROM wash_receive_batches b
     LEFT JOIN users u ON u.id = b.user_id
     WHERE b.hospital_id = ? AND b.created_at BETWEEN ? AND ?
     ORDER BY b.created_at DESC
     LIMIT 500`,
    [tenantId, `${from} 00:00:00`, `${to} 23:59:59`]
  );

  if (rows.length === 0) return [];

  const batchIds = rows.map((r) => r.id);
  const [itemRows] = await pool.query(
    `SELECT sl.batch_id, fi.epc_code, fc.id AS category_id, fc.name AS category_name
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE sl.event_type = 'WASH_RECEIVE' AND sl.batch_id IN (${batchIds.map(() => '?').join(',')})
     ORDER BY sl.scanned_at ASC`,
    batchIds
  );

  const itemsByBatch = new Map();
  for (const row of itemRows) {
    if (!itemsByBatch.has(row.batch_id)) itemsByBatch.set(row.batch_id, []);
    itemsByBatch.get(row.batch_id).push({
      epcCode: row.epc_code,
      categoryName: row.category_name ?? 'ไม่ระบุหมวดหมู่',
    });
  }

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    weightKg: Number(row.weight_kg),
    itemCount: row.item_count,
    userName: row.user_name ?? '—',
    items: itemsByBatch.get(row.id) ?? [],
  }));
}

async function fetchSummaryByCategory(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT fc.id AS category_id, fc.name AS category_name, COUNT(*) AS cnt
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE sl.hospital_id = ? AND sl.event_type = 'WASH_RECEIVE'
       AND sl.scanned_at BETWEEN ? AND ?
     GROUP BY fc.id, fc.name
     ORDER BY cnt DESC`,
    [tenantId, `${from} 00:00:00`, `${to} 23:59:59`]
  );

  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name ?? 'ไม่ระบุหมวดหมู่',
    itemCount: Number(row.cnt),
  }));
}

/**
 * GET /api/v1/wash-receive-report — ทุก role (อ่านอย่างเดียว)
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (default วันนี้ทั้งคู่) — คุมทั้งช่วงวันที่ของตาราง
 * ชุดสแกนและสรุปยอดตามหมวดหมู่ ฝั่งหน้าเว็บคำนวณช่วงวันที่จาก preset (วันนี้/เดือนนี้/เดือนที่แล้ว/
 * ปีนี้/ปีที่แล้ว) หรือเลือกเองก็ได้ ดู wash-receive-date-filter-card.jsx
 */
export const getWashReceiveReport = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { from, to } = buildDateRange(req.query.startDate, req.query.endDate);

  const batches = await fetchBatches(tenantId, from, to);
  const byCategory = await fetchSummaryByCategory(tenantId, from, to);

  const totals = {
    totalBatches: batches.length,
    totalItems: batches.reduce((sum, b) => sum + b.itemCount, 0),
    totalWeightKg: Math.round(batches.reduce((sum, b) => sum + b.weightKg, 0) * 1000) / 1000,
  };

  return res.json({ range: { from, to }, totals, byCategory, batches });
});
