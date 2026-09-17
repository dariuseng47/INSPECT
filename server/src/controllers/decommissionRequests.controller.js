import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getIO } from '../sockets/ioInstance.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { resolveTenantId } from '../utils/tenant.js';

// คำขอแทงชำรุดที่ยิงมาจากมือถือ (nativeapp/) เข้าสถานะ PENDING เสมอ ต้องให้ admin ของ
// โรงพยาบาลนั้นกด approve/reject ที่นี่ก่อนถึงจะมีผลจริงกับ fabric_items.status — ดู
// fabricItems.controller.js#decommissionFabricItem ที่เป็นจุดสร้าง record เหล่านี้

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

// hold_decommission_records ไม่มีคอลัมน์ hospital_id ของตัวเอง (tenant-scope ผ่าน fabric_item_id)
// เหมือนที่ fabricItems.controller.js คอมเมนต์ไว้ — join กับ fabric_items เพื่อกรอง tenant ทุกครั้ง
async function findTenantScopedRequest(tenantId, id) {
  const [rows] = await pool.query(
    `SELECT r.*, f.epc_code, f.hospital_id
     FROM hold_decommission_records r
     JOIN fabric_items f ON f.id = r.fabric_item_id
     WHERE r.id = ? AND r.action_type = 'DECOMMISSION' AND f.hospital_id = ?
     LIMIT 1`,
    [id, tenantId]
  );
  return rows[0];
}

// หาคำขอแบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin approve/reject
async function findRequestAnyTenant(id) {
  const [rows] = await pool.query(
    `SELECT r.*, f.epc_code, f.hospital_id
     FROM hold_decommission_records r
     JOIN fabric_items f ON f.id = r.fabric_item_id
     WHERE r.id = ? AND r.action_type = 'DECOMMISSION'
     LIMIT 1`,
    [id]
  );
  return rows[0];
}

/**
 * GET /api/v1/decommission-requests — admin ของโรงพยาบาล หรือ superadmin (ต้องระบุ ?hospitalId= เสมอ)
 */
export const listDecommissionRequests = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้น');
  }

  const tenantId = await resolveTenantId(req);
  const status = req.query.status ?? 'PENDING';
  const [requests] = await pool.query(
    `SELECT r.*, f.epc_code, f.status AS fabric_item_status
     FROM hold_decommission_records r
     JOIN fabric_items f ON f.id = r.fabric_item_id
     WHERE r.action_type = 'DECOMMISSION' AND r.status = ? AND f.hospital_id = ?
     ORDER BY r.created_at DESC`,
    [status, tenantId]
  );

  return res.json({ requests });
});

/**
 * POST /api/v1/decommission-requests/:id/approve — admin ของโรงพยาบาล หรือ superadmin
 */
export const approveDecommissionRequest = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ approve ได้');
  }

  const request =
    req.auth.role === 'SUPERADMIN'
      ? await findRequestAnyTenant(req.params.id)
      : await findTenantScopedRequest(req.auth.hospitalId, req.params.id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอนี้');
  const tenantId = request.hospital_id;
  if (request.status !== 'PENDING') {
    throw new AppError(400, 'INVALID_STATE', 'คำขอนี้ถูกตรวจสอบไปแล้ว');
  }

  await pool.query(
    `UPDATE hold_decommission_records SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [req.auth.userId, request.id]
  );
  await pool.query(`UPDATE fabric_items SET status = 'DECOMMISSIONED' WHERE id = ?`, [
    request.fabric_item_id,
  ]);

  const payload = { id: request.id, fabricItemId: request.fabric_item_id, epcCode: request.epc_code };
  emitToHospital(tenantId, 'fabric:decommission-reviewed', { ...payload, decision: 'APPROVED' });
  emitToHospital(tenantId, 'fabric:decommission', payload);

  return res.json({ id: request.id, fabricItemId: request.fabric_item_id, status: 'DECOMMISSIONED' });
});

/**
 * POST /api/v1/decommission-requests/:id/reject — admin เท่านั้น
 */
export const rejectDecommissionRequest = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ reject ได้');
  }

  const request =
    req.auth.role === 'SUPERADMIN'
      ? await findRequestAnyTenant(req.params.id)
      : await findTenantScopedRequest(req.auth.hospitalId, req.params.id);
  if (!request) throw new AppError(404, 'NOT_FOUND', 'ไม่พบคำขอนี้');
  const tenantId = request.hospital_id;
  if (request.status !== 'PENDING') {
    throw new AppError(400, 'INVALID_STATE', 'คำขอนี้ถูกตรวจสอบไปแล้ว');
  }

  const { reviewNote } = req.body;

  await pool.query(
    `UPDATE hold_decommission_records
     SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
     WHERE id = ?`,
    [req.auth.userId, reviewNote ?? null, request.id]
  );
  // คืนสถานะ fabric_items กลับไปเป็นค่าก่อนเข้า PENDING_DECOMMISSION (บันทึกไว้ตอนสร้างคำขอ)
  await pool.query(`UPDATE fabric_items SET status = ? WHERE id = ?`, [
    request.previous_status,
    request.fabric_item_id,
  ]);

  emitToHospital(tenantId, 'fabric:decommission-reviewed', {
    id: request.id,
    fabricItemId: request.fabric_item_id,
    epcCode: request.epc_code,
    decision: 'REJECTED',
  });

  return res.json({
    id: request.id,
    fabricItemId: request.fabric_item_id,
    status: request.previous_status,
  });
});
