import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getGlobalSettings } from '../utils/globalSettings.js';

async function findTenantScopedCabinet(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('cabinets', { id, deleted_at: null });
  return rows[0];
}

// หา department/cabinet แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน superadmin แก้ไข
// (ซึ่งไม่มี hospital_id ของตัวเอง) เหมือนแพทเทิร์นใน departments.controller.js
async function findDepartmentAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0];
}

async function findCabinetAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM cabinets WHERE id = ? AND deleted_at IS NULL', [id]);
  return rows[0];
}

/**
 * GET /api/v1/cabinets
 */
export const listCabinets = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const where = { deleted_at: null };
  if (req.query.departmentId) where.department_id = req.query.departmentId;

  const cabinets = await scopedQuery(pool, tenantId).select('cabinets', where);
  return res.json({ cabinets });
});

/**
 * POST /api/v1/cabinets — admin เท่านั้น ตู้ต้องผูกกับแผนกระดับ WARD เท่านั้น
 */
export const createCabinet = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่เพิ่มตู้ได้');
  }

  const { name, departmentId } = req.body;

  // ผูก tenant ตามเจ้าของ departmentId ที่ระบุมาเลย (ไม่ต้องให้ superadmin ส่ง hospitalId แยกซ้ำ)
  const department = await findDepartmentAnyTenant(departmentId);
  if (!department) throw new AppError(404, 'NOT_FOUND', 'ไม่พบแผนกนี้');
  await assertTenantAccess(req, department.hospital_id);
  const tenantId = department.hospital_id;
  if (department.level_type !== 'WARD') {
    throw new AppError(400, 'VALIDATION_ERROR', 'ตู้เก็บผ้าผูกได้เฉพาะกับแผนกระดับ WARD เท่านั้น');
  }

  const result = await scopedQuery(pool, tenantId).insert('cabinets', {
    name,
    department_id: departmentId,
  });

  return res.status(201).json({ id: result.insertId, name, departmentId });
});

/**
 * PATCH /api/v1/cabinets/:id
 */
export const updateCabinet = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้ไขตู้ได้');
  }

  const cabinet = await findCabinetAnyTenant(req.params.id);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้นี้');
  await assertTenantAccess(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;

  const { name } = req.body;
  if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');

  await scopedQuery(pool, tenantId).update('cabinets', { id: cabinet.id }, { name });
  return res.status(204).send();
});

/**
 * DELETE /api/v1/cabinets/:id
 */
export const deleteCabinet = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ลบตู้ได้');
  }

  const cabinet = await findCabinetAnyTenant(req.params.id);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้นี้');
  await assertTenantAccess(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;

  await scopedQuery(pool, tenantId).update(
    'cabinets',
    { id: cabinet.id },
    { deleted_at: new Date() }
  );
  return res.status(204).send();
});

/**
 * GET /api/v1/cabinets/:id/par-levels
 */
export const getParLevels = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const cabinet = await findTenantScopedCabinet(tenantId, req.params.id);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้นี้');

  // cabinet_par_levels ไม่มี hospital_id ของตัวเอง (tenant-scope ผ่าน cabinet_id ที่เช็คแล้วข้างบน)
  const [parLevels] = await pool.query('SELECT * FROM cabinet_par_levels WHERE cabinet_id = ?', [
    cabinet.id,
  ]);

  return res.json({ parLevels });
});

/**
 * PUT /api/v1/cabinets/:id/par-levels — admin เท่านั้น แทนที่ทั้งชุด (delete แล้ว insert ใหม่)
 */
export const upsertParLevels = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่ตั้งค่า par level ได้');
  }

  const cabinet = await findCabinetAnyTenant(req.params.id);
  if (!cabinet) throw new AppError(404, 'NOT_FOUND', 'ไม่พบตู้นี้');
  await assertTenantAccess(req, cabinet.hospital_id);
  const tenantId = cabinet.hospital_id;

  const { parLevels } = req.body;

  // ตรวจว่าทุกหมวดหมู่ที่ระบุเป็นของ tenant นี้จริง กันแอบยัด fabric_category_id ข้าม tenant
  const categoryIds = parLevels.map((p) => p.fabricCategoryId);
  const ownedCategories = await scopedQuery(pool, tenantId).select('fabric_categories', {});
  const ownedIds = new Set(ownedCategories.map((c) => c.id));
  const invalidId = categoryIds.find((id) => !ownedIds.has(id));
  if (invalidId) {
    throw new AppError(400, 'VALIDATION_ERROR', `ไม่พบหมวดหมู่ผ้า id ${invalidId} ในโรงพยาบาลนี้`);
  }

  await pool.query('DELETE FROM cabinet_par_levels WHERE cabinet_id = ?', [cabinet.id]);

  // ไม่ระบุ warningPct มา -> fallback ไปใช้ค่ามาตรฐานกลางที่ superadmin ตั้งไว้ (Global System Config)
  const globalSettings = await getGlobalSettings();

  for (const level of parLevels) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      'INSERT INTO cabinet_par_levels (cabinet_id, fabric_category_id, par_level_qty, warning_pct) VALUES (?, ?, ?, ?)',
      [
        cabinet.id,
        level.fabricCategoryId,
        level.parLevelQty,
        level.warningPct ?? globalSettings.default_par_level_warning_pct,
      ]
    );
  }

  return res.status(204).send();
});
