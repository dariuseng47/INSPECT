import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/fabric-categories
 */
export const listCategories = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const categories = await scopedQuery(pool, tenantId).select('fabric_categories');
  return res.json({ categories });
});

/**
 * POST /api/v1/fabric-categories — admin ของโรงพยาบาล หรือ superadmin (ต้องระบุ hospitalId เอง)
 */
export const createCategory = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่สร้างหมวดหมู่ผ้าได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { name, description, maxWashCycles } = req.body;
  const result = await scopedQuery(pool, tenantId).insert('fabric_categories', {
    name,
    description: description || null,
    max_wash_cycles: maxWashCycles ?? null,
  });

  return res.status(201).json({
    id: result.insertId,
    name,
    description: description || null,
    maxWashCycles: maxWashCycles ?? null,
  });
});

/**
 * PATCH /api/v1/fabric-categories/:id — admin ของโรงพยาบาล หรือ superadmin (แก้ไขหมวดหมู่ของ รพ. ใดก็ได้)
 */
export const updateCategory = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้ไขหมวดหมู่ผ้าได้');
  }

  const [rows] = await pool.query('SELECT * FROM fabric_categories WHERE id = ?', [req.params.id]);
  const category = rows[0];
  if (!category) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบหมวดหมู่ผ้านี้');
  }
  await assertTenantAccess(req, category.hospital_id);
  const tenantId = category.hospital_id;

  const { name, description, maxWashCycles } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description || null;
  if (maxWashCycles !== undefined) updates.max_wash_cycles = maxWashCycles;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await scopedQuery(pool, tenantId).update('fabric_categories', { id: req.params.id }, updates);
  return res.status(204).send();
});
