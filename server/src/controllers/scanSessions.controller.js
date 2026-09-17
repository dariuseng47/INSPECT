import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Flow: แอดมินเลือกล็อต + อุปกรณ์ handheld ที่ผูกไว้ -> trigger (ยิง socket event ไปที่ห้อง
// hospital:<id> ให้แอปบนเครื่อง handheld เข้าโหมดสแกน) -> เครื่องสแกนแล้วส่งรายการ EPC กลับมา
// (report) -> แอดมินตรวจสอบแล้วกดยืนยันบนเว็บ (confirm) ค่อย commit เป็น fabric_items จริง
//
// หมายเหตุ: ตอนนี้ยังไม่มีแอป handheld จริง (nativeapp/ ว่างเปล่า) และยังไม่มี device-token auth
// endpoint /report จึงเปิดให้ user (admin/operator) เรียกได้เหมือนกันไปก่อน — เมื่อสร้างแอป
// handheld จริงจะต้องเปลี่ยนไปใช้ device-token auth แยกต่างหาก (ไม่ใช้ user JWT)

async function findTenantScopedSession(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('registration_scan_sessions', { id });
  return rows[0];
}

// หา session/device แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin ดำเนินการ
async function findSessionAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM registration_scan_sessions WHERE id = ?', [id]);
  return rows[0];
}

async function findDeviceAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
  return rows[0];
}

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

/**
 * POST /api/v1/scan-sessions — trigger session ใหม่ (admin/operator)
 * ผูกล็อต (fabricLotId) หรือระบุแค่หมวดหมู่ตรงๆ ไม่ผูกล็อต (fabricCategoryId) ก็ได้ — อย่างใด
 * อย่างหนึ่ง (validate แล้วที่ schema) เหมือน createFabricItem/bulkCreateFabricItems ที่ยอมให้
 * ลงทะเบียนแบบไม่มีล็อตได้เช่นกัน ดู fabricItems.controller.js
 */
export const triggerScanSession = asyncHandler(async (req, res) => {
  const { fabricLotId, fabricCategoryId, deviceId } = req.body;

  // ผูก tenant ตามเจ้าของ deviceId ที่ระบุมาเลย (ไม่ต้องให้ superadmin ส่ง hospitalId แยกซ้ำ)
  const device = await findDeviceAnyTenant(deviceId);
  if (!device) throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  await assertTenantAccess(req, device.hospital_id);
  const tenantId = device.hospital_id;

  let lot = null;
  let category = null;

  if (fabricLotId) {
    const lots = await scopedQuery(pool, tenantId).select('fabric_lots', { id: fabricLotId });
    lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้านี้');
  } else {
    const categories = await scopedQuery(pool, tenantId).select('fabric_categories', {
      id: fabricCategoryId,
    });
    category = categories[0];
    if (!category) throw new AppError(404, 'NOT_FOUND', 'ไม่พบหมวดหมู่ผ้านี้');
  }

  if (device.device_type !== 'HANDHELD') {
    throw new AppError(400, 'VALIDATION_ERROR', 'อุปกรณ์ที่เลือกไม่ใช่ handheld scanner');
  }

  const result = await scopedQuery(pool, tenantId).insert('registration_scan_sessions', {
    fabric_lot_id: lot?.id ?? null,
    fabric_category_id: lot ? null : category.id,
    device_id: deviceId,
    status: 'PENDING',
    triggered_by: req.auth.userId,
  });

  const session = {
    id: result.insertId,
    fabricLotId: lot?.id ?? null,
    fabricCategoryId: lot ? null : category.id,
    deviceId,
    lotCode: lot?.lot_code ?? null,
    categoryName: category?.name ?? null,
    status: 'PENDING',
  };

  // ยิงไปทั้งห้อง hospital:<id> — อุปกรณ์ handheld (เมื่อมีแอปจริง) filter เอาเฉพาะ deviceId ตัวเอง
  emitToHospital(tenantId, 'scan:trigger', session);

  return res.status(201).json({ session });
});

/**
 * GET /api/v1/scan-sessions — รายการ session ที่ยัง "ค้าง" (default: PENDING/SCANNING/REPORTED)
 *
 * ให้แอดมินบนเว็บเห็น session ที่ trigger มาจากเครื่อง handheld เอง (ไม่ได้กด trigger จากการ์ด
 * บนเว็บ) แล้วกดยืนยัน/ยกเลิกได้ — ไม่งั้นผ้าที่สแกนจาก handheld จะค้างสถานะ REPORTED
 * ("รอ admin ตรวจสอบ") ตลอดไป ไม่ถูก commit เป็น fabric_items จริง = ไม่เข้าคลังผ้าสักที
 *
 * join lot_code / ชื่อหมวดหมู่ / ชื่อผู้ถือ handheld ให้ frontend แสดงได้เลย — ต้องใช้ raw SQL
 * เพราะ scopedQuery ไม่รองรับ JOIN (บังคับ WHERE s.hospital_id = ? ไว้ให้ tenant isolation แล้ว)
 */
export const listScanSessions = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const DEFAULT_STATUSES = ['PENDING', 'SCANNING', 'REPORTED'];
  const requested = req.query.status
    ? String(req.query.status)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => DEFAULT_STATUSES.concat('CONFIRMED', 'CANCELLED').includes(s))
    : DEFAULT_STATUSES;
  const statuses = requested.length ? requested : DEFAULT_STATUSES;
  const placeholders = statuses.map(() => '?').join(', ');

  const [sessions] = await pool.query(
    `SELECT s.*, l.lot_code, c.name AS category_name,
            d.caretaker_name AS device_caretaker_name,
            u.full_name AS triggered_by_name
     FROM registration_scan_sessions s
     LEFT JOIN fabric_lots l ON l.id = s.fabric_lot_id
     LEFT JOIN fabric_categories c ON c.id = s.fabric_category_id
     LEFT JOIN devices d ON d.id = s.device_id
     LEFT JOIN users u ON u.id = s.triggered_by
     WHERE s.hospital_id = ? AND s.status IN (${placeholders})
     ORDER BY s.created_at DESC`,
    [tenantId, ...statuses]
  );

  return res.json({ sessions });
});

/**
 * GET /api/v1/scan-sessions/:id
 */
export const getScanSession = asyncHandler(async (req, res) => {
  const tenantId = req.auth.role === 'SUPERADMIN' ? Number(req.query.hospitalId) : req.auth.hospitalId;
  const session = await findTenantScopedSession(tenantId, req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');

  return res.json({ session });
});

/**
 * POST /api/v1/scan-sessions/:id/report — อุปกรณ์ (หรือ user ไปพลางก่อน) ส่งรายการ EPC ที่สแกนเจอ
 */
export const reportScanSession = asyncHandler(async (req, res) => {
  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  const tenantId = session.hospital_id;
  if (session.status === 'CONFIRMED' || session.status === 'CANCELLED') {
    throw new AppError(400, 'INVALID_STATE', 'session นี้ปิดไปแล้ว รายงานผลเพิ่มไม่ได้');
  }

  const { epcCodes } = req.body;

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    { status: 'REPORTED', scanned_epcs: JSON.stringify(epcCodes) }
  );

  emitToHospital(tenantId, 'scan:reported', { sessionId: session.id, epcCodes });

  return res.json({ sessionId: session.id, status: 'REPORTED', epcCodes });
});

/**
 * POST /api/v1/scan-sessions/:id/confirm — admin ตรวจสอบแล้วยืนยัน commit เป็น fabric_items จริง
 */
export const confirmScanSession = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin หรือ superadmin เท่านั้นที่ยืนยัน session ได้');
  }

  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  const tenantId = session.hospital_id;
  if (session.status !== 'REPORTED') {
    throw new AppError(400, 'INVALID_STATE', 'session นี้ยังไม่มีผลสแกนให้ยืนยัน');
  }

  // session ผูกล็อต หรือระบุแค่หมวดหมู่ตรงๆ ก็ได้ (ดู triggerScanSession) — resolve หมวดหมู่จาก
  // อย่างใดอย่างหนึ่งที่ session นี้มี
  let fabricCategoryId = session.fabric_category_id;
  if (session.fabric_lot_id) {
    const lots = await scopedQuery(pool, tenantId).select('fabric_lots', { id: session.fabric_lot_id });
    const lot = lots[0];
    if (!lot) throw new AppError(404, 'NOT_FOUND', 'ไม่พบล็อตผ้าของ session นี้');
    if (!lot.fabric_category_id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ล็อตนี้ยังไม่ได้ระบุหมวดหมู่ผ้า ยืนยันไม่ได้');
    }
    fabricCategoryId = lot.fabric_category_id;
  }

  // mysql2 แปลงคอลัมน์ JSON กลับเป็น JS array/object ให้อัตโนมัติตอน SELECT อยู่แล้ว
  // (ห้าม JSON.parse ซ้ำ ไม่งั้น array จะถูก toString() ก่อนแล้ว parse ไม่ผ่าน)
  const scannedEpcs = session.scanned_epcs || [];
  const epcCodes = req.body.epcCodes ?? scannedEpcs;

  const created = [];
  const skipped = [];

  for (const epcCode of epcCodes) {
    // epc_code unique ระดับ global — เช็คซ้ำข้ามทุกโรงพยาบาลเหมือน fabricItems.controller.js
    // eslint-disable-next-line no-await-in-loop
    const [existing] = await pool.query('SELECT id FROM fabric_items WHERE epc_code = ? LIMIT 1', [
      epcCode,
    ]);
    if (existing[0]) {
      skipped.push(epcCode);
      // eslint-disable-next-line no-continue
      continue;
    }

    // created_by = คนที่ trigger/ถือ handheld สแกนเข้ามา (session.triggered_by) ไม่ใช่ admin
    // ที่กด confirm — ตรงกับ "ผ้านี้ใครแอดมา" ที่หมายถึงคนทำงานหน้างานจริง
    // eslint-disable-next-line no-await-in-loop
    await scopedQuery(pool, tenantId).insert('fabric_items', {
      epc_code: epcCode,
      fabric_category_id: fabricCategoryId,
      fabric_lot_id: session.fabric_lot_id ?? null,
      status: 'CENTRAL_STOCK',
      current_location_type: 'CENTRAL_STOCK',
      current_location_id: null,
      wash_count: 0,
      created_by: session.triggered_by,
    });
    created.push(epcCode);
  }

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    {
      status: 'CONFIRMED',
      confirmed_by: req.auth.userId,
      confirmed_at: new Date(),
    }
  );

  emitToHospital(tenantId, 'scan:confirmed', { sessionId: session.id, created, skipped });

  return res.json({ sessionId: session.id, status: 'CONFIRMED', created, skipped });
});

/**
 * POST /api/v1/scan-sessions/:id/cancel
 */
export const cancelScanSession = asyncHandler(async (req, res) => {
  const session = await findSessionAnyTenant(req.params.id);
  if (!session) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ scan session นี้');
  await assertTenantAccess(req, session.hospital_id);
  const tenantId = session.hospital_id;

  await scopedQuery(pool, tenantId).update(
    'registration_scan_sessions',
    { id: session.id },
    { status: 'CANCELLED' }
  );

  emitToHospital(tenantId, 'scan:cancelled', { sessionId: session.id });

  return res.status(204).send();
});
