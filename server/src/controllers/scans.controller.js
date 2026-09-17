import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasAnyPermission, permKeysForLegacy } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Operator-facing scan actions for nativeapp/ — ward dispatch/receive. Simplified vs. the
// full "1st scan (read cabinet) -> replenish -> 2nd scan (cart -> cabinet)" par-level
// replenishment flow in Advanced_Feature_Details&Rules.md: this pass is a direct
// EPC -> cabinet issue/receive (manual EPC entry stand-in for a real scanner, see
// nativeapp/src/components/ScannerInput.jsx). Cart-tracking/replenishment counting is
// a later iteration.

export function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

export async function findTenantScopedFabricItemByEpc(tenantId, epcCode) {
  const rows = await scopedQuery(pool, tenantId).select('fabric_items', { epc_code: epcCode });
  return rows[0];
}

// หา cabinet/fabric_item แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin ดำเนินการ
// (epc_code เป็น unique key ระดับ global อยู่แล้ว เหมือนที่ fabricItems.controller.js คอมเมนต์ไว้)
async function findCabinetAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM cabinets WHERE id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
}

async function findFabricItemByEpcAnyTenant(epcCode) {
  const [rows] = await pool.query('SELECT * FROM fabric_items WHERE epc_code = ? LIMIT 1', [epcCode]);
  return rows[0];
}

/**
 * POST /api/v1/scans/ward-issue — จ่ายผ้าจากคลังกลางไปตู้ประจำวอร์ด (admin/operator)
 */
export const wardIssue = asyncHandler(async (req, res) => {
  const { epcCode, cabinetId, roundId } = req.body;

  const cabinet = await findCabinetAnyTenant(cabinetId);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้เก็บผ้านี้');
  await assertTenantAccess(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;

  const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED' || item.status === 'PENDING_DECOMMISSION') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ถูกพัก/แทงชำรุด/รออนุมัติแทงชำรุดอยู่ จ่ายออกไม่ได้');
  }

  // ถ้าผ้าชิ้นนี้อยู่ในตู้อื่นอยู่แล้ว (current_location_type = CABINET) การ ward-issue ครั้งนี้คือ
  // "โอนผ้าข้ามตู้" ไม่ใช่การเติมผ้าจากสต๊อกกลางตามปกติ — บันทึกไว้ใน metadata เพื่อให้หน้ารายงาน
  // (restock report) แยกนับสองแบบนี้ออกจากกันได้ ดู restockReport.controller.js
  const isTransfer = item.current_location_type === 'CABINET' && item.current_location_id !== cabinet.id;
  const fromCabinetId = isTransfer ? item.current_location_id : null;

  // roundId มาจาก cabinet-audit ก่อนหน้า (ขั้นตรวจนับตู้ผ้า) — ผูกชิ้นนี้เข้า "รอบ" เดียวกันเพื่อให้
  // หน้าประวัติการจ่ายผ้าสรุปได้ ตรวจสอบว่าเป็นรอบของ tenant นี้จริงก่อน (กัน id ข้าม tenant/หมดอายุ)
  let validatedRoundId = null;
  if (roundId) {
    const rounds = await scopedQuery(pool, tenantId).select('ward_issue_rounds', { id: roundId });
    if (rounds[0]) validatedRoundId = rounds[0].id;
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WARD_CABINET', current_location_type: 'CABINET', current_location_id: cabinet.id }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_ISSUE',
    round_id: validatedRoundId,
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
    metadata: JSON.stringify({ cabinetId: cabinet.id, isTransfer, fromCabinetId, roundId: roundId ?? null }),
  });

  emitToHospital(tenantId, 'scan:ward-issue', {
    fabricItemId: item.id,
    epcCode,
    cabinetId: cabinet.id,
    fabricCategoryId: item.fabric_category_id,
  });

  return res.status(201).json({
    fabricItemId: item.id,
    epcCode,
    status: 'WARD_CABINET',
    cabinetId: cabinet.id,
  });
});

/**
 * POST /api/v1/scans/cabinet-audit — ขั้นที่ 1 ของ "จ่ายผ้าไปวอร์ด": สแกนหน้าตู้ (bulk) ตรวจนับของ
 * คงเหลือจริงก่อนไปหยิบผ้าจากรถมาจัดเข้า (ขั้นที่ 2 ยังใช้ wardIssue เดิมทีละชิ้น ไม่แตะ) แต่ละ EPC
 * ที่สแกนเจอจะถูกบันทึกลง scan_logs (event_type CABINET_AUDIT) เสมอ ไม่ว่าจะตรงตู้ที่ระบบบันทึกไว้
 * หรือไม่ก็ตาม — ชิ้นที่ระบบไม่ได้บันทึกว่าอยู่ตู้นี้ (เช่น เดิมอยู่วอร์ดอื่น หรือยังไม่เคยจ่ายออก) จะ
 * ถูกตีเป็น anomaly ให้หน้าจอโชว์เตือน + ปุ่ม "โอนผ้าเข้าแผนกนี้" (เรียก wardIssue เดิมกับ EPC นั้นได้เลย
 * ฝั่ง client ไม่ต้อง endpoint ใหม่)
 *
 * epcCodes เป็น [] ได้ — เคส "เติมผ้าครั้งแรก" ตู้เปล่าไม่มีผ้าเดิมให้สแกน: เปิดรอบ + คืน reconciliation
 * ที่ขาดเต็ม par level แล้วปลดล็อกขั้นจ่ายผ้าเข้าตู้ต่อได้ตามปกติ
 */
export const cabinetAudit = asyncHandler(async (req, res) => {
  const { cabinetId, epcCodes } = req.body;

  const cabinet = await findCabinetAnyTenant(cabinetId);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้เก็บผ้านี้');
  await assertTenantAccess(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;

  // เปิด "รอบ" จ่ายผ้าใหม่ทุกครั้งที่ตรวจนับตู้ผ้าสำเร็จ — ward-issue ที่ตามมาหลังจากนี้ (ทั้งจากขั้นที่ 2
  // และปุ่มโอนผ้าเข้าแผนกนี้จากรายการ anomaly) จะผูก round_id นี้ ให้หน้าประวัติการจ่ายผ้าสรุปได้
  const roundResult = await scopedQuery(pool, tenantId).insert('ward_issue_rounds', {
    cabinet_id: cabinet.id,
    user_id: req.auth.userId,
  });
  const roundId = roundResult.insertId;

  const uniqueEpcs = [...new Set(epcCodes)];
  const found = [];
  const unknownEpcs = [];
  const anomalies = [];

  for (const epcCode of uniqueEpcs) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      unknownEpcs.push(epcCode);
      continue; // eslint-disable-line no-continue
    }

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: null,
      user_id: req.auth.userId,
      event_type: 'CABINET_AUDIT',
      is_step_skipped: false,
      synced_from_offline: false,
      scanned_at: new Date(),
    });

    const belongsHere = item.current_location_type === 'CABINET' && item.current_location_id === cabinet.id;
    if (!belongsHere) {
      anomalies.push(item);
    }

    found.push(item);
  }

  const categoryIds = [...new Set(found.map((item) => item.fabric_category_id))];
  const categoryNameById = new Map();
  if (categoryIds.length > 0) {
    const [categoryRows] = await pool.query(
      `SELECT id, name FROM fabric_categories WHERE id IN (${categoryIds.map(() => '?').join(',')})`,
      categoryIds
    );
    for (const row of categoryRows) categoryNameById.set(row.id, row.name);
  }

  const anomalyPayload = anomalies.map((item) => ({
    fabricItemId: item.id,
    epcCode: item.epc_code,
    fabricCategoryId: item.fabric_category_id,
    categoryName: categoryNameById.get(item.fabric_category_id) ?? null,
    status: item.status,
    currentLocationType: item.current_location_type,
  }));

  // นับของจริงที่สแกนเจอต่อหมวดหมู่ (รวมของ anomaly ด้วย — สแกนเจอในตู้จริง ถือว่ากินพื้นที่ par level
  // ของตู้นี้อยู่แล้วไม่ว่าระบบจะบันทึกตำแหน่งไว้ตรงกันหรือยัง)
  const actualByCategory = new Map();
  for (const item of found) {
    actualByCategory.set(item.fabric_category_id, (actualByCategory.get(item.fabric_category_id) || 0) + 1);
  }

  const [parLevelRows] = await pool.query(
    `SELECT cabinet_par_levels.fabric_category_id, cabinet_par_levels.par_level_qty,
            cabinet_par_levels.warning_pct, fabric_categories.name AS category_name
     FROM cabinet_par_levels
     JOIN fabric_categories ON fabric_categories.id = cabinet_par_levels.fabric_category_id
     WHERE cabinet_par_levels.cabinet_id = ?`,
    [cabinet.id]
  );

  // สูตร low-stock เดียวกับ alerts.controller.js (par level ต่ำกว่าเกณฑ์ warning_pct)
  const reconciliation = parLevelRows.map((row) => {
    const actualQty = actualByCategory.get(row.fabric_category_id) || 0;
    return {
      fabricCategoryId: row.fabric_category_id,
      categoryName: row.category_name,
      parLevelQty: row.par_level_qty,
      actualQty,
      shortageQty: Math.max(row.par_level_qty - actualQty, 0),
      lowStock: actualQty <= (row.par_level_qty * row.warning_pct) / 100,
    };
  });

  emitToHospital(tenantId, 'scan:cabinet-audit', {
    cabinetId: cabinet.id,
    scannedCount: found.length,
    anomalyCount: anomalyPayload.length,
  });

  return res.status(201).json({
    cabinetId: cabinet.id,
    roundId,
    scannedCount: found.length,
    unknownEpcs,
    anomalies: anomalyPayload,
    reconciliation,
  });
});

/**
 * POST /api/v1/scans/ward-receive — รับผ้าใช้แล้วกลับจากวอร์ดเข้าสู่รอบซักถัดไป (admin/operator)
 */
export const wardReceive = asyncHandler(async (req, res) => {
  const { epcCode } = req.body;

  const item = await findFabricItemByEpcAnyTenant(epcCode);
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');
  await assertTenantAccess(req, item.hospital_id);
  const tenantId = item.hospital_id;
  if (item.status !== 'WARD_CABINET' && item.status !== 'IN_USE_WARD') {
    throw new AppError(400, 'INVALID_STATE', 'ผ้าชิ้นนี้ไม่ได้อยู่ที่วอร์ด รับเข้าไม่ได้');
  }

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: item.id },
    { status: 'WASH', current_location_type: 'CENTRAL_STOCK', current_location_id: null }
  );

  await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: req.auth.userId,
    event_type: 'WARD_RECEIVE',
    is_step_skipped: false,
    synced_from_offline: false,
    scanned_at: new Date(),
  });

  emitToHospital(tenantId, 'scan:ward-receive', {
    fabricItemId: item.id,
    epcCode,
    fabricCategoryId: item.fabric_category_id,
  });

  return res.json({ fabricItemId: item.id, epcCode, status: 'WASH' });
});

/**
 * POST /api/v1/scans/wash-receive-batch — "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" (admin/operator, หน้าเว็บ)
 * จำลองจุดอ่าน RFID ที่ประตูชั่งน้ำหนัก: สแกนหลาย EPC พร้อมกันเป็นชุด ใช้น้ำหนักเดียวกันทั้งชุด แล้ว
 * เปลี่ยนสถานะจาก IN_USE_WARD/WARD_CABINET ตรงเป็น WASH รวดเดียว (WASH = "รับผ้าหลังซัก &
 * ชั่งน้ำหนักผ้า" — สถานะยุบเหลือ 4 ตัว ดู migration 023 / fabric-constants.js)
 * สแกน/ชั่งจริงยังไม่เชื่อมฮาร์ดแวร์ ตอนนี้กรอก epcCodes/weightKg เองจากหน้าเว็บก่อน (มาต่อฮาร์ดแวร์จริง
 * ทีหลังโดยยิง endpoint เดิมนี้แทนได้เลย ไม่ต้องแก้ contract)
 * STEP_SKIPPED: ผ้าที่ไม่ได้อยู่สถานะ IN_USE_WARD/WARD_CABINET มาก่อน — ไม่ block แค่ flag ไว้ตรวจสอบทีหลัง
 */
export const washReceiveBatch = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { epcCodes, weightKg } = req.body;

  const batchResult = await scopedQuery(pool, tenantId).insert('wash_receive_batches', {
    weight_kg: weightKg,
    item_count: 0,
    user_id: req.auth.userId,
  });
  const batchId = batchResult.insertId;
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

    const isStepSkipped = item.status !== 'IN_USE_WARD' && item.status !== 'WARD_CABINET';

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      {
        status: 'WASH',
        wash_count: item.wash_count + 1,
        current_location_type: 'CENTRAL_STOCK',
        current_location_id: null,
      }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: null,
      user_id: req.auth.userId,
      event_type: 'WASH_RECEIVE',
      batch_id: batchId,
      weight_kg: weightKg,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: scannedAt,
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  await scopedQuery(pool, tenantId).update(
    'wash_receive_batches',
    { id: batchId },
    { item_count: processed.length }
  );

  emitToHospital(tenantId, 'scan:wash-receive', {
    batchId,
    weightKg,
    processed,
  });

  return res.status(201).json({ batchId, weightKg, processed, skipped });
});

/**
 * POST /api/v1/scans/status-change — เมนู "เปลี่ยนสถานะผ้า" บนมือถือ + ปุ่มเปลี่ยนสถานะใน popup
 * หน้าคลังผ้า (dashboard)
 * สแกนผ้าเป็นชุด เลือกสถานะก่อน (fromStatus) / หลัง (toStatus) เองได้ เป็นเครื่องมือแก้/ปรับสถานะ
 * ด้วยมือสำหรับเคสตกหล่น
 *
 * สิทธิ์: superadmin ได้เสมอ — admin/operator ต้องได้รับสิทธิ์ fabric.item.status_change รายคน
 * (ไม่มีใน role_default_permissions ดู migration 027) confirm=true บันทึก audit_logs
 * action = 'FABRIC_STATUS_CHANGED' เพิ่มเติมจาก scan_logs ต่อชิ้น
 *
 * confirm=false -> preview เท่านั้น: จัดกลุ่มว่าชิ้นไหนสถานะตรง (ready) / ไม่ตรง (mismatched) /
 *   เปลี่ยนไม่ได้เพราะพัก-แทงชำรุด (blocked) / เป็น toStatus อยู่แล้ว (alreadyDone) / ไม่พบ (notFound)
 * confirm=true -> เปลี่ยนจริงทั้ง ready + mismatched (ตามที่ผู้ใช้กำหนดว่า "เตือนแล้วเปลี่ยนให้ด้วย")
 *   ทุกชิ้นบันทึก scan_logs STATUS_CHANGE + metadata { fromStatus, toStatus, prevStatus, mismatched }
 */
const STATUS_CHANGE_BLOCKED = new Set(['HOLD', 'DECOMMISSIONED', 'PENDING_DECOMMISSION']);

export const statusChange = asyncHandler(async (req, res) => {
  const allowed = await hasAnyPermission(
    req.auth.userId,
    req.auth.role,
    permKeysForLegacy('fabric.item.status_change')
  );
  if (!allowed) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'ไม่มีสิทธิ์เปลี่ยนสถานะผ้า กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์ให้'
    );
  }

  const tenantId = await resolveTenantId(req);
  const { fromStatus, toStatus, confirm } = req.body;
  const epcCodes = [...new Set(req.body.epcCodes)];

  const ready = []; // { epcCode, currentStatus } — สถานะตรง fromStatus
  const mismatched = []; // { epcCode, currentStatus } — เจอ เปลี่ยนได้ แต่สถานะไม่ตรง
  const blocked = []; // { epcCode, currentStatus } — พัก/แทงชำรุด/รออนุมัติ เปลี่ยนไม่ได้
  const alreadyDone = []; // { epcCode } — เป็น toStatus อยู่แล้ว
  const notFound = []; // epcCode[]
  const itemByEpc = new Map();

  for (const epcCode of epcCodes) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      notFound.push(epcCode);
    } else if (STATUS_CHANGE_BLOCKED.has(item.status)) {
      blocked.push({ epcCode, currentStatus: item.status });
    } else if (item.status === toStatus) {
      alreadyDone.push({ epcCode });
    } else {
      itemByEpc.set(epcCode, item);
      if (item.status === fromStatus) ready.push({ epcCode, currentStatus: item.status });
      else mismatched.push({ epcCode, currentStatus: item.status });
    }
  }

  if (!confirm) {
    return res.json({
      preview: true,
      fromStatus,
      toStatus,
      ready,
      mismatched,
      blocked,
      alreadyDone,
      notFound,
    });
  }

  const scannedAt = new Date();
  const applied = [];
  for (const { epcCode } of [...ready, ...mismatched]) {
    const item = itemByEpc.get(epcCode);
    const isMismatch = item.status !== fromStatus;

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update('fabric_items', { id: item.id }, { status: toStatus });

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: null,
      user_id: req.auth.userId,
      event_type: 'STATUS_CHANGE',
      is_step_skipped: isMismatch,
      synced_from_offline: false,
      metadata: JSON.stringify({
        fromStatus,
        toStatus,
        prevStatus: item.status,
        mismatched: isMismatch,
      }),
      scanned_at: scannedAt,
    });

    applied.push({ epcCode, prevStatus: item.status, mismatched: isMismatch });
  }

  if (applied.length > 0) {
    await logAudit({
      hospitalId: tenantId,
      userId: req.auth.userId,
      action: 'FABRIC_STATUS_CHANGED',
      entityType: 'fabric_item',
      entityId: null,
      metadata: {
        fromStatus,
        toStatus,
        count: applied.length,
        epcCodes: applied.map((a) => a.epcCode),
        mismatchedCount: applied.filter((a) => a.mismatched).length,
      },
    });
  }

  emitToHospital(tenantId, 'scan:status-change', {
    fromStatus,
    toStatus,
    count: applied.length,
  });

  return res.status(201).json({
    preview: false,
    fromStatus,
    toStatus,
    applied,
    blocked,
    alreadyDone,
    notFound,
  });
});

/**
 * GET /api/v1/scans/ward-issue-rounds — "ประวัติการจ่ายผ้า" บนมือถือ: แต่ละ "รอบ" = 1 ครั้งที่ตรวจนับ
 * ตู้ผ้าสำเร็จ (ดู cabinetAudit ด้านบน) พร้อมสรุปว่ารอบนั้นจ่ายผ้าอะไรไปบ้าง กี่ชิ้น — ข้ามรอบที่ตรวจนับ
 * แล้วแต่ไม่ได้จ่ายอะไรออกเลย (เช่น ออกจากหน้าจอก่อนถึงขั้นที่ 2)
 */
export const listWardIssueRounds = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const limit = req.query.limit ?? 20;

  const [rounds] = await pool.query(
    `SELECT wir.id AS round_id, wir.created_at, wir.cabinet_id,
            c.name AS cabinet_name, d.name AS department_name, u.full_name AS user_name
     FROM ward_issue_rounds wir
     JOIN cabinets c ON c.id = wir.cabinet_id
     JOIN departments d ON d.id = c.department_id
     JOIN users u ON u.id = wir.user_id
     WHERE wir.hospital_id = ?
     ORDER BY wir.created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );

  if (rounds.length === 0) return res.json({ rounds: [] });

  const roundIds = rounds.map((r) => r.round_id);
  const [items] = await pool.query(
    `SELECT sl.round_id, fi.epc_code, fi.fabric_category_id, fc.name AS category_name
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE sl.event_type = 'WARD_ISSUE' AND sl.round_id IN (${roundIds.map(() => '?').join(',')})
     ORDER BY sl.scanned_at ASC`,
    roundIds
  );

  const itemsByRound = new Map();
  for (const item of items) {
    if (!itemsByRound.has(item.round_id)) itemsByRound.set(item.round_id, []);
    itemsByRound.get(item.round_id).push({ epcCode: item.epc_code, categoryName: item.category_name });
  }

  const payload = rounds
    .map((round) => {
      const roundItems = itemsByRound.get(round.round_id) || [];
      const categoryBreakdown = [];
      const countByCategory = new Map();
      for (const item of roundItems) {
        countByCategory.set(item.categoryName, (countByCategory.get(item.categoryName) || 0) + 1);
      }
      for (const [categoryName, count] of countByCategory) categoryBreakdown.push({ categoryName, count });

      return {
        roundId: round.round_id,
        cabinetName: round.cabinet_name,
        departmentName: round.department_name,
        userName: round.user_name,
        createdAt: round.created_at,
        itemCount: roundItems.length,
        categoryBreakdown,
        items: roundItems,
      };
    })
    .filter((round) => round.itemCount > 0);

  return res.json({ rounds: payload });
});

/**
 * POST /api/v1/scans/weight-gate — device token เท่านั้น (WEIGHT_GATE edge device)
 * จุดที่ 3 ตาม Advanced_Feature_Details&Rules.md — ชั่งน้ำหนัก + อ่าน RFID 3 จุดพร้อมกันเป็นชุด
 * (epcCodes หลายชิ้นต่อการชั่ง 1 ครั้ง ใช้ weightKg เดียวกันทั้งชุด)
 * STEP_SKIPPED: ผ้าที่ไม่ได้อยู่สถานะ WASH มาก่อน (เช่น โผล่มาทั้งที่ยังอยู่ตู้แผนก/ใช้งานอยู่ที่วอร์ด
 * โดยไม่ผ่าน ward-receive ให้ครบ flow ก่อน) — ไม่ block การชั่ง แค่ flag ไว้ให้ตรวจสอบทีหลัง
 */
export const weightGate = asyncHandler(async (req, res) => {
  const tenantId = req.device.hospitalId;
  const { epcCodes, weightKg, sensorError } = req.body;

  const processed = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      skipped.push({ epcCode, reason: 'NOT_FOUND' });
      continue; // eslint-disable-line no-continue
    }
    if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
      skipped.push({ epcCode, reason: 'INVALID_STATE' });
      continue; // eslint-disable-line no-continue
    }

    // ยุบสถานะแล้ว WASH = "รับผ้าหลังซัก & ชั่งน้ำหนักผ้า" — จุดชั่งน้ำหนักไม่เปลี่ยนสถานะต่อ
    // (แค่บันทึก event + weight) ผ้าที่มาถึงจุดนี้ควรเป็น WASH อยู่แล้วจาก ward-receive
    const isStepSkipped = item.status !== 'WASH';

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      {
        status: 'WASH',
        wash_count: item.wash_count + 1,
        current_location_type: 'CENTRAL_STOCK',
        current_location_id: null,
      }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: req.device.id,
      user_id: null,
      event_type: 'WEIGHT_COUNT',
      weight_kg: sensorError ? null : weightKg,
      sensor_error: sensorError,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: new Date(),
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  emitToHospital(tenantId, 'scan:created', {
    eventType: 'WEIGHT_COUNT',
    deviceId: req.device.id,
    processed,
  });

  return res.status(201).json({ processed, skipped, sensorError });
});

/**
 * POST /api/v1/scans/bundle-check — device token เท่านั้น (FOLDING_TABLE edge device)
 * จุดที่ 4 ตาม Advanced_Feature_Details&Rules.md — อ่าน RFID มัดผ้าที่พับเสร็จ 1 มัดต่อการสแกน 1 ครั้ง
 * เทียบจำนวนชิ้นกับ target_bundle_size ที่ตั้งไว้ต่อเครื่อง (NULL = ไม่เช็ค) และบันทึก RSSI ต่อชิ้น
 * ให้หน้า "แจ้งเตือน & ข้อยกเว้น" ดักจับสัญญาณอ่อนได้เหมือนเดิม (query จากคอลัมน์เดียวกัน)
 */
export const bundleCheck = asyncHandler(async (req, res) => {
  const tenantId = req.device.hospitalId;
  const { epcCodes, rssiDbm } = req.body;

  const [deviceRows] = await pool.query('SELECT target_bundle_size FROM devices WHERE id = ?', [
    req.device.id,
  ]);
  const targetBundleSize = deviceRows[0]?.target_bundle_size ?? null;

  const processed = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // eslint-disable-next-line no-await-in-loop
    const item = await findTenantScopedFabricItemByEpc(tenantId, epcCode);
    if (!item) {
      skipped.push({ epcCode, reason: 'NOT_FOUND' });
      continue; // eslint-disable-line no-continue
    }
    if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
      skipped.push({ epcCode, reason: 'INVALID_STATE' });
      continue; // eslint-disable-line no-continue
    }

    // ยุบสถานะแล้ว โต๊ะพับไม่เปลี่ยนสถานะต่อ (คงเป็น WASH) — แค่บันทึก event + เทียบจำนวนมัด
    const isStepSkipped = item.status !== 'WASH';

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      { status: 'WASH' }
    );

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('scan_logs', {
      fabric_item_id: item.id,
      device_id: req.device.id,
      user_id: null,
      event_type: 'BUNDLE_CHECK',
      rssi_dbm: rssiDbm ?? null,
      is_step_skipped: isStepSkipped,
      synced_from_offline: false,
      scanned_at: new Date(),
    });

    processed.push({ epcCode, fabricItemId: item.id, stepSkipped: isStepSkipped });
  }

  const bundleSizeMismatch = targetBundleSize !== null && processed.length !== targetBundleSize;

  emitToHospital(tenantId, 'scan:created', {
    eventType: 'BUNDLE_CHECK',
    deviceId: req.device.id,
    processed,
    bundleSizeMismatch,
  });

  return res
    .status(201)
    .json({ processed, skipped, targetBundleSize, actualCount: processed.length, bundleSizeMismatch });
});
