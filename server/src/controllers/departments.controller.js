import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ลำดับชั้นบังคับ: BUILDING (ราก, ไม่มี parent) -> FLOOR (parent ต้องเป็น BUILDING)
// -> WARD (parent ต้องเป็น FLOOR) — ดู docs/data-model.md
const REQUIRED_PARENT_LEVEL = { FLOOR: 'BUILDING', WARD: 'FLOOR' };

/**
 * GET /api/v1/departments — คืน flat list ทั้งหมดของ tenant (frontend ประกอบเป็น tree เอง)
 * เรียงตาม sort_order ให้แล้ว (ลำดับที่ admin ลากจัดไว้ ภายใน parent เดียวกัน)
 */
export const listDepartments = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const departments = await scopedQuery(pool, tenantId).select('departments', { deleted_at: null });
  departments.sort((a, b) => a.sort_order - b.sort_order);
  return res.json({ departments });
});

async function findTenantScopedDepartment(tenantId, id) {
  const rows = await scopedQuery(pool, tenantId).select('departments', { id, deleted_at: null });
  return rows[0];
}

// หา department แบบไม่ผูก tenant — ใช้หา hospital_id เจ้าของจริงตอน update/delete โดย superadmin
// (ซึ่งไม่มี hospital_id ของตัวเอง) จากนั้นค่อยเอา hospital_id นั้นไปใช้ scope query ที่เหลือ
// เหมือนแพทเทิร์นใน syncConflicts.controller.js::approveConflict
async function findDepartmentAnyTenant(id) {
  const [rows] = await pool.query('SELECT * FROM departments WHERE id = ? AND deleted_at IS NULL', [
    id,
  ]);
  return rows[0];
}

/**
 * POST /api/v1/departments — admin ของโรงพยาบาล หรือ superadmin (ต้องระบุ hospitalId เอง)
 */
export const createDepartment = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้โครงสร้างได้');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }
  const { name, levelType, parentId } = req.body;

  const requiredParentLevel = REQUIRED_PARENT_LEVEL[levelType];

  if (!requiredParentLevel) {
    // BUILDING — ต้องไม่มี parent
    if (parentId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'BUILDING ต้องไม่มี parent (เป็นระดับบนสุด)');
    }
  } else {
    if (!parentId) {
      throw new AppError(400, 'VALIDATION_ERROR', `${levelType} ต้องระบุ parentId (${requiredParentLevel})`);
    }
    const parent = await findTenantScopedDepartment(tenantId, parentId);
    if (!parent) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ parent department นี้');
    if (parent.level_type !== requiredParentLevel) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `${levelType} ต้องอยู่ใต้ ${requiredParentLevel} เท่านั้น (parent ที่เลือกเป็น ${parent.level_type})`
      );
    }
  }

  // ต่อท้ายลำดับของพี่น้องใน parent เดียวกันเสมอ (ลากจัดลำดับเองทีหลังได้)
  const siblings = await scopedQuery(pool, tenantId).select('departments', {
    parent_id: parentId ?? null,
    deleted_at: null,
  });

  const result = await scopedQuery(pool, tenantId).insert('departments', {
    name,
    level_type: levelType,
    parent_id: parentId ?? null,
    sort_order: siblings.length,
  });

  return res.status(201).json({ id: result.insertId, name, levelType, parentId: parentId ?? null });
});

/**
 * PATCH /api/v1/departments/:id — แก้ชื่อ และ/หรือ ย้าย parent (ใช้ตอน drag-and-drop)
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้โครงสร้างได้');
  }

  const department = await findDepartmentAnyTenant(req.params.id);
  if (!department) throw new AppError(404, 'NOT_FOUND', 'ไม่พบแผนกนี้');
  await assertTenantAccess(req, department.hospital_id);
  const tenantId = department.hospital_id;

  const { name, parentId, sortOrder } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;

  if (parentId !== undefined) {
    const requiredParentLevel = REQUIRED_PARENT_LEVEL[department.level_type];

    if (!requiredParentLevel) {
      throw new AppError(400, 'VALIDATION_ERROR', 'BUILDING ย้าย parent ไม่ได้ (เป็นระดับบนสุดเสมอ)');
    }
    if (parentId === null) {
      throw new AppError(400, 'VALIDATION_ERROR', `${department.level_type} ต้องมี parent เสมอ`);
    }
    if (parentId === department.id) {
      throw new AppError(400, 'VALIDATION_ERROR', 'ย้ายเข้าตัวเองไม่ได้');
    }

    const newParent = await findTenantScopedDepartment(tenantId, parentId);
    if (!newParent) throw new AppError(404, 'NOT_FOUND', 'ไม่พบ parent department ใหม่');
    if (newParent.level_type !== requiredParentLevel) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        `${department.level_type} ต้องอยู่ใต้ ${requiredParentLevel} เท่านั้น`
      );
    }
    updates.parent_id = parentId;
  }

  if (Object.keys(updates).length === 0 && sortOrder === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  if (Object.keys(updates).length > 0) {
    await scopedQuery(pool, tenantId).update('departments', { id: department.id }, updates);
  }

  // ลากจัดลำดับ — คำนวณตำแหน่งใหม่ในกลุ่มพี่น้อง (parent เดียวกัน) แล้วเรียงเลข sort_order
  // ใหม่ทั้งกลุ่มเป็น 0..n-1 ตามตำแหน่งที่ลากไปวาง (parent ที่ใช้คือ parent ใหม่ถ้าเปลี่ยนพร้อมกัน)
  if (sortOrder !== undefined) {
    const targetParentId = updates.parent_id !== undefined ? updates.parent_id : department.parent_id;

    const siblings = await scopedQuery(pool, tenantId).select('departments', {
      parent_id: targetParentId,
      deleted_at: null,
    });

    const ordered = siblings
      .filter((s) => s.id !== department.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const insertAt = Math.min(Math.max(sortOrder, 0), ordered.length);
    ordered.splice(insertAt, 0, department);

    for (let i = 0; i < ordered.length; i += 1) {
      await scopedQuery(pool, tenantId).update('departments', { id: ordered[i].id }, { sort_order: i });
    }
  }

  return res.status(204).send();
});

/**
 * DELETE /api/v1/departments/:id — บล็อกถ้ายังมีแผนกย่อยหรือตู้ผูกอยู่ (กันข้อมูลกำพร้า)
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  if (!['ADMIN', 'SUPERADMIN'].includes(req.auth.role)) {
    throw new AppError(403, 'FORBIDDEN', 'ต้องเป็น admin ของโรงพยาบาลหรือ superadmin เท่านั้นที่แก้โครงสร้างได้');
  }

  const department = await findDepartmentAnyTenant(req.params.id);
  if (!department) throw new AppError(404, 'NOT_FOUND', 'ไม่พบแผนกนี้');
  await assertTenantAccess(req, department.hospital_id);
  const tenantId = department.hospital_id;

  const children = await scopedQuery(pool, tenantId).select('departments', {
    parent_id: department.id,
    deleted_at: null,
  });
  if (children.length > 0) {
    throw new AppError(400, 'HAS_CHILDREN', 'ลบไม่ได้ เพราะยังมีแผนกย่อยอยู่ข้างใต้ — ย้ายหรือลบแผนกย่อยก่อน');
  }

  const cabinets = await scopedQuery(pool, tenantId).select('cabinets', {
    department_id: department.id,
    deleted_at: null,
  });
  if (cabinets.length > 0) {
    throw new AppError(400, 'HAS_CABINETS', 'ลบไม่ได้ เพราะยังมีตู้เก็บผ้าผูกกับแผนกนี้อยู่');
  }

  await scopedQuery(pool, tenantId).update(
    'departments',
    { id: department.id },
    { deleted_at: new Date() }
  );
  return res.status(204).send();
});
