import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToHospital, findTenantScopedFabricItemByEpc } from './scans.controller.js';

// "สแกนเข้าสต๊อค" — สแกนผ้าที่ซัก/อบ/พับเสร็จผ่านเครื่องอ่าน RFID ที่จุดตรวจสอบ (device_type =
// RFID_CHECKPOINT) เป็นชุด (ปกติ ~4-5 ชิ้น/รอบ) เปลี่ยนสถานะเป็น CENTRAL_STOCK ทั้งชุด ใช้คู่กับ
// POST /rfid-reader/scan เป็น 2 ขั้น (สแกนอ่านแท็กก่อน แล้วยืนยันรายการที่เลือกมาที่ endpoint นี้)
// เหมือน checkpoint-scan-card.jsx ตอนลงทะเบียนผ้าใหม่ — ดู server/db/migrations/020_stock_scan_rounds.sql

// สถานะที่ถือว่า "อยู่ระหว่างซัก/อบ/พับ" ก่อนเข้าสต๊อคกลาง — ผ้าที่ไม่ได้อยู่สถานะเหล่านี้ (เช่น
// สแกนซ้ำผ้าที่เข้าสต๊อคกลางไปแล้ว หรือผ้าที่ยังอยู่วอร์ด) จะถูก flag เป็น STEP_SKIPPED ไม่ block
const PRE_STOCK_STATUSES = new Set(['WASH']);

/**
 * POST /api/v1/scans/stock-scan — สิทธิ์คุมด้วย requireAnyPermission('web.operations.stock_scan.edit')
 * ที่ชั้น route แล้ว (OPERATOR ได้ default) — ไม่ต้องเช็ค role ซ้ำในนี้
 * รับรายการ EPC ที่อ่านได้จากเครื่องอ่าน RFID จุดตรวจสอบมายืนยัน เปลี่ยนสถานะเป็น CENTRAL_STOCK
 * ทั้งชุด บันทึกเป็น "รอบการสแกน" (stock_scan_rounds) ไว้ตรวจสอบย้อนหลังได้ว่าสแกนกี่ชิ้น ตอนไหน ใครสแกน
 */
export const stockScan = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { epcCodes, deviceId } = req.body;

  const roundResult = await scopedQuery(pool, tenantId).insert('stock_scan_rounds', {
    device_id: deviceId ?? null,
    item_count: 0,
    user_id: req.auth.userId,
  });
  const roundId = roundResult.insertId;
  const scannedAt = new Date();

  const processed = [];
  const skipped = [];

  const uniqueEpcs = [...new Set(epcCodes)];
  for (const epcCode of uniqueEpcs) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      skipped.push({ epcCode, reason: 'NOT_FOUND' });
      continue; // eslint-disable-line no-continue
    }
    if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED' || item.status === 'PENDING_DECOMMISSION') {
      skipped.push({ epcCode, reason: 'INVALID_STATE' });
      continue; // eslint-disable-line no-continue
    }

    const isStepSkipped = !PRE_STOCK_STATUSES.has(item.status);

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      { status: 'CENTRAL_STOCK', current_location_type: 'CENTRAL_STOCK', current_location_id: null }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: deviceId ?? null,
      user_id: req.auth.userId,
      event_type: 'STOCK_SCAN',
      stock_round_id: roundId,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: scannedAt,
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  await scopedQuery(pool, tenantId).update(
    'stock_scan_rounds',
    { id: roundId },
    { item_count: processed.length }
  );

  emitToHospital(tenantId, 'scan:stock-scan', { roundId, processed });

  return res.status(201).json({ roundId, processed, skipped });
});

/**
 * GET /api/v1/scans/stock-scan-rounds — "ประวัติการสแกนเข้าสต๊อค" แต่ละ "รอบ" = 1 ครั้งที่กดยืนยัน
 * สแกนเข้าสต๊อค (ดู stockScan ด้านบน) พร้อมรายชิ้นที่อยู่ในรอบนั้น
 */
export const listStockScanRounds = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const limit = req.query.limit ?? 20;

  const [rounds] = await pool.query(
    `SELECT r.id AS round_id, r.created_at, r.item_count, d.id AS device_id,
            u.full_name AS user_name
     FROM stock_scan_rounds r
     LEFT JOIN devices d ON d.id = r.device_id
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.hospital_id = ?
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );

  if (rounds.length === 0) return res.json({ rounds: [] });

  const roundIds = rounds.map((r) => r.round_id);
  const [items] = await pool.query(
    `SELECT sl.stock_round_id, fi.epc_code, fc.name AS category_name
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE sl.event_type = 'STOCK_SCAN' AND sl.stock_round_id IN (${roundIds.map(() => '?').join(',')})
     ORDER BY sl.scanned_at ASC`,
    roundIds
  );

  const itemsByRound = new Map();
  for (const item of items) {
    if (!itemsByRound.has(item.stock_round_id)) itemsByRound.set(item.stock_round_id, []);
    itemsByRound.get(item.stock_round_id).push({
      epcCode: item.epc_code,
      categoryName: item.category_name ?? 'ไม่ระบุหมวดหมู่',
    });
  }

  const payload = rounds.map((round) => ({
    roundId: round.round_id,
    createdAt: round.created_at,
    itemCount: round.item_count,
    deviceId: round.device_id,
    userName: round.user_name ?? '—',
    items: itemsByRound.get(round.round_id) ?? [],
  }));

  return res.json({ rounds: payload });
});
