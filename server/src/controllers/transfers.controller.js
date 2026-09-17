import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// hard-coded boundary — nav ทั้งหมวด "ศูนย์บริหารเครือข่าย" ถูกกันไว้ให้ superadmin เท่านั้น
// (ดู dashboard/src/layouts/config-nav-dashboard.jsx roles: ['SUPERADMIN']) จึงล็อกที่ประตูนี้เหมือนกัน
// docs/api-spec.md เผื่อ "admin(allow-listed)" ไว้เป็น scope ในอนาคต ยังไม่ได้เปิดใช้งานตอนนี้
function assertSuperadmin(auth) {
  if (auth.role !== 'SUPERADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'เฉพาะ superadmin เท่านั้นที่จัดการการโอนย้ายข้ามโรงพยาบาลได้');
  }
}

/**
 * GET /api/v1/transfers — superadmin เท่านั้น
 */
export const listTransfers = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const conditions = [];
  const values = [];
  if (req.query.hospitalId) {
    conditions.push('(tr.from_hospital_id = ? OR tr.to_hospital_id = ?)');
    values.push(req.query.hospitalId, req.query.hospitalId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT tr.id, tr.fabric_item_id, fi.epc_code,
            tr.from_hospital_id, fh.name AS from_hospital_name,
            tr.to_hospital_id, th.name AS to_hospital_name,
            tr.approved_by, u.full_name AS approved_by_name,
            tr.transferred_at
     FROM transfer_records tr
     JOIN fabric_items fi ON fi.id = tr.fabric_item_id
     JOIN hospitals fh ON fh.id = tr.from_hospital_id
     JOIN hospitals th ON th.id = tr.to_hospital_id
     JOIN users u ON u.id = tr.approved_by
     ${where}
     ORDER BY tr.transferred_at DESC
     LIMIT 200`,
    values
  );

  return res.json({ transfers: rows });
});

/**
 * POST /api/v1/transfers — superadmin เท่านั้น
 * ย้าย hospital_id ของ fabric_item ข้าม tenant ตาม docs/data-model.md หลักการข้อ 3
 * (epc_code เป็น global unique key ไม่เปลี่ยนตอนย้าย) — ต้องระบุหมวดหมู่ผ้าปลายทางด้วย เพราะ
 * fabric_categories ผูกกับ tenant เดิมไม่สามารถใช้ข้ามโรงพยาบาลได้ (fabric_lot_id set เป็น NULL
 * เพราะ lot ผูกกับการจัดซื้อของโรงพยาบาลต้นทางเดิม ไม่มีความหมายที่ปลายทาง)
 */
export const createTransfer = asyncHandler(async (req, res) => {
  assertSuperadmin(req.auth);

  const { epcCode, toHospitalId, toCategoryId } = req.body;

  const [itemRows] = await pool.query(
    'SELECT * FROM fabric_items WHERE epc_code = ? AND deleted_at IS NULL LIMIT 1',
    [epcCode]
  );
  const item = itemRows[0];
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');

  if (item.status === 'HOLD' || item.status === 'DECOMMISSIONED') {
    throw new AppError(400, 'VALIDATION_ERROR', 'ผ้าที่พักใช้งานหรือแทงชำรุดแล้วโอนย้ายข้ามโรงพยาบาลไม่ได้');
  }
  if (item.hospital_id === toHospitalId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ผ้าชิ้นนี้อยู่ที่โรงพยาบาลปลายทางอยู่แล้ว');
  }

  const [hospitalRows] = await pool.query(
    'SELECT id FROM hospitals WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [toHospitalId]
  );
  if (!hospitalRows[0]) throw new AppError(404, 'NOT_FOUND', 'ไม่พบโรงพยาบาลปลายทาง');

  const [categoryRows] = await pool.query(
    'SELECT id FROM fabric_categories WHERE id = ? AND hospital_id = ? LIMIT 1',
    [toCategoryId, toHospitalId]
  );
  if (!categoryRows[0]) {
    throw new AppError(400, 'VALIDATION_ERROR', 'หมวดหมู่ผ้าที่เลือกไม่ได้เป็นของโรงพยาบาลปลายทาง');
  }

  const fromHospitalId = item.hospital_id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE fabric_items
       SET hospital_id = ?, fabric_category_id = ?, fabric_lot_id = NULL,
           status = 'CENTRAL_STOCK', current_location_type = NULL, current_location_id = NULL
       WHERE id = ?`,
      [toHospitalId, toCategoryId, item.id]
    );

    const [result] = await connection.query(
      'INSERT INTO transfer_records (fabric_item_id, from_hospital_id, to_hospital_id, approved_by) VALUES (?, ?, ?, ?)',
      [item.id, fromHospitalId, toHospitalId, req.auth.userId]
    );

    await connection.commit();

    await logAudit({
      hospitalId: fromHospitalId,
      userId: req.auth.userId,
      action: 'FABRIC_TRANSFERRED',
      entityType: 'fabric_item',
      entityId: item.id,
      metadata: { epcCode, fromHospitalId, toHospitalId, toCategoryId },
    });

    return res.status(201).json({ id: result.insertId, epcCode, fromHospitalId, toHospitalId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
