import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emitToHospital, findTenantScopedFabricItemByEpc } from './scans.controller.js';

// ตาม docs/offline-sync-conflict-resolution.md — รองรับเฉพาะ WARD_ISSUE/WARD_RECEIVE
// (event ที่ operator มือถือ/edge agent ยิงตอนออฟไลน์ได้จริงตอนนี้ ดู scans.controller.js)
function computeTarget(event) {
  if (event.eventType === 'WARD_ISSUE') {
    return { targetStatus: 'WARD_CABINET', targetLocationId: event.cabinetId };
  }
  return { targetStatus: 'WASH', targetLocationId: null };
}

async function insertOfflineScanLog(tenantId, item, event, userId) {
  const result = await scopedQuery(pool, tenantId).insert('scan_logs', {
    fabric_item_id: item.id,
    device_id: null,
    user_id: userId,
    event_type: event.eventType,
    is_step_skipped: false,
    synced_from_offline: true,
    metadata: event.cabinetId ? JSON.stringify({ cabinetId: event.cabinetId }) : null,
    scanned_at: new Date(event.scannedAt),
  });
  return result.insertId;
}

/**
 * POST /api/v1/sync/batch — operator (มือถือออฟไลน์) ตาม docs/api-spec.md
 * นิยาม conflict: event ของ epc_code เดียวกันในชุด batch นี้ที่ผลลัพธ์ (สถานะ+ตำแหน่ง) ต่างกัน
 * และยังไม่ถูก apply เข้า fabric_items จริง — เก็บทั้งสองไว้รอ approve ไม่ auto-merge
 * ตาม docs/offline-sync-conflict-resolution.md ("หลักการ")
 */
export const syncBatch = asyncHandler(async (req, res) => {
  if (req.auth.role === 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ดำเนินการนี้');
  }

  const tenantId = req.auth.hospitalId;
  const { events } = req.body;

  const byEpc = new Map();
  for (const event of events) {
    if (!byEpc.has(event.epcCode)) byEpc.set(event.epcCode, []);
    byEpc.get(event.epcCode).push(event);
  }

  const applied = [];
  const conflicts = [];
  const skipped = [];

  for (const [epcCode, epcEvents] of byEpc) {
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

    const withTargets = epcEvents.map((event) => ({ ...event, ...computeTarget(event) }));
    const distinctTargets = new Set(
      withTargets.map((e) => `${e.targetStatus}:${e.targetLocationId}`)
    );

    if (distinctTargets.size > 1) {
      const [candidateA, candidateB] = withTargets;

      // eslint-disable-next-line no-await-in-loop
      const logAId = await insertOfflineScanLog(tenantId, item, candidateA, req.auth.userId);
      // eslint-disable-next-line no-await-in-loop
      const logBId = await insertOfflineScanLog(tenantId, item, candidateB, req.auth.userId);

      // eslint-disable-next-line no-await-in-loop
      const conflictResult = await scopedQuery(pool, tenantId).insert('sync_conflicts', {
        fabric_item_id: item.id,
        candidate_a_scan_log_id: logAId,
        candidate_b_scan_log_id: logBId,
        status: 'PENDING',
      });

      conflicts.push({ conflictId: conflictResult.insertId, epcCode });
      emitToHospital(tenantId, 'sync:conflict_detected', {
        conflictId: conflictResult.insertId,
        fabricItemId: item.id,
        epcCode,
      });
      continue; // eslint-disable-line no-continue
    }

    // ไม่ conflict — ใช้ event ล่าสุดตาม scannedAt เป็น canonical (last-write-wins ตามหลักการในเอกสาร)
    const latest = [...withTargets].sort(
      (a, b) => new Date(a.scannedAt) - new Date(b.scannedAt)
    )[withTargets.length - 1];

    if (latest.eventType === 'WARD_ISSUE') {
      // eslint-disable-next-line no-await-in-loop
      const cabinets = await scopedQuery(pool, tenantId).select('cabinets', {
        id: latest.cabinetId,
        deleted_at: null,
      });
      if (!cabinets[0]) {
        skipped.push({ epcCode, reason: 'CABINET_NOT_FOUND' });
        continue; // eslint-disable-line no-continue
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).update(
      'fabric_items',
      { id: item.id },
      {
        status: latest.targetStatus,
        current_location_type: latest.targetLocationId ? 'CABINET' : 'CENTRAL_STOCK',
        current_location_id: latest.targetLocationId,
      }
    );

    // eslint-disable-next-line no-await-in-loop
    await insertOfflineScanLog(tenantId, item, latest, req.auth.userId);

    applied.push({ epcCode, fabricItemId: item.id, status: latest.targetStatus });
    emitToHospital(tenantId, 'scan:created', {
      eventType: latest.eventType,
      fabricItemId: item.id,
      epcCode,
    });
  }

  return res.status(201).json({ applied, conflicts, skipped });
});

/**
 * GET /api/v1/sync/conflicts — superadmin (ทุกโรงพยาบาล, กรอง ?hospitalId= ได้) /
 * admin (เฉพาะ tenant ตัวเอง บังคับ) — เหมือนแพทเทิร์น audit-logs
 */
export const listConflicts = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const conditions = ["sc.status = 'PENDING'"];
  const values = [];

  if (req.auth.role === 'ADMIN') {
    conditions.push('sc.hospital_id = ?');
    values.push(req.auth.hospitalId);
  } else if (req.query.hospitalId) {
    conditions.push('sc.hospital_id = ?');
    values.push(req.query.hospitalId);
  }

  const [rows] = await pool.query(
    `SELECT sc.id, sc.fabric_item_id, fi.epc_code, sc.status, sc.created_at,
            sc.hospital_id, h.name AS hospital_name,
            a.id AS a_id, a.event_type AS a_event_type, a.user_id AS a_user_id,
            au.full_name AS a_user_name, a.scanned_at AS a_scanned_at, ca.name AS a_cabinet_name,
            b.id AS b_id, b.event_type AS b_event_type, b.user_id AS b_user_id,
            bu.full_name AS b_user_name, b.scanned_at AS b_scanned_at, cb.name AS b_cabinet_name
     FROM sync_conflicts sc
     JOIN fabric_items fi ON fi.id = sc.fabric_item_id
     JOIN hospitals h ON h.id = sc.hospital_id
     JOIN scan_logs a ON a.id = sc.candidate_a_scan_log_id
     JOIN scan_logs b ON b.id = sc.candidate_b_scan_log_id
     LEFT JOIN users au ON au.id = a.user_id
     LEFT JOIN users bu ON bu.id = b.user_id
     LEFT JOIN cabinets ca ON ca.id = JSON_UNQUOTE(JSON_EXTRACT(a.metadata, '$.cabinetId'))
     LEFT JOIN cabinets cb ON cb.id = JSON_UNQUOTE(JSON_EXTRACT(b.metadata, '$.cabinetId'))
     WHERE ${conditions.join(' AND ')}
     ORDER BY sc.created_at DESC`,
    values
  );

  return res.json({ conflicts: rows });
});

/**
 * POST /api/v1/sync/conflicts/:id/approve — superadmin (ทุกโรงพยาบาล) /
 * admin (เฉพาะ tenant ตัวเอง) เลือก candidate ที่ถูกต้อง apply เข้า fabric_items.status จริง
 * ก้อนที่ไม่ถูกเลือกยังอยู่ใน scan_logs เดิมเพื่อ audit (ไม่ลบ) ตาม
 * docs/offline-sync-conflict-resolution.md — tenant มาจาก conflict.hospital_id เองเสมอ
 * (ไม่ใช้ req.auth.hospitalId ตรงๆ เพราะ superadmin ไม่มี tenant ของตัวเอง)
 */
export const approveConflict = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  }

  const { chosen } = req.body;

  const [conflictRows] = await pool.query(
    "SELECT * FROM sync_conflicts WHERE id = ? AND status = 'PENDING' LIMIT 1",
    [req.params.id]
  );
  const conflict = conflictRows[0];
  if (!conflict) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ conflict นี้ หรือถูก resolve ไปแล้ว');

  await assertTenantAccess(req, conflict.hospital_id);

  const tenantId = conflict.hospital_id;

  const chosenLogId =
    chosen === 'A' ? conflict.candidate_a_scan_log_id : conflict.candidate_b_scan_log_id;

  const [logRows] = await pool.query('SELECT * FROM scan_logs WHERE id = ?', [chosenLogId]);
  const chosenLog = logRows[0];

  const targetStatus = chosenLog.event_type === 'WARD_ISSUE' ? 'WARD_CABINET' : 'WASH';

  await scopedQuery(pool, tenantId).update(
    'fabric_items',
    { id: conflict.fabric_item_id },
    { status: targetStatus }
  );

  await scopedQuery(pool, tenantId).update(
    'sync_conflicts',
    { id: conflict.id },
    {
      status: 'RESOLVED',
      resolved_scan_log_id: chosenLogId,
      resolved_by: req.auth.userId,
      resolved_at: new Date(),
    }
  );

  emitToHospital(tenantId, 'sync:conflict_resolved', {
    conflictId: conflict.id,
    fabricItemId: conflict.fabric_item_id,
    chosen,
  });

  return res.status(204).send();
});
