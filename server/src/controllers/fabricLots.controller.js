import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasAnyPermission, permKeysForLegacy } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/fabric-lots — join ชื่อผู้เพิ่มล็อต (admin) + ชื่อหมวดหมู่ผ้า ให้ตารางแสดงผลได้เลย
 * ไม่ต้อง join เพิ่มฝั่ง frontend เอง
 */
export const listLots = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const [lots] = await pool.query(
    `SELECT l.*, u.full_name AS created_by_name, c.name AS category_name
     FROM fabric_lots l
     LEFT JOIN users u ON u.id = l.created_by
     LEFT JOIN fabric_categories c ON c.id = l.fabric_category_id
     WHERE l.hospital_id = ?
     ORDER BY l.id DESC`,
    [tenantId]
  );
  return res.json({ lots });
});

/**
 * POST /api/v1/fabric-lots — admin เสมอ / operator ต้องได้รับสิทธิ์ 'fabric.lot.create'
 * จาก admin ก่อน (ดู docs/rbac-permissions.md, default: operator ปิด)
 * สร้างแค่ "หัวล็อต" (lot_code, quantity, purchased_at) — EPC รายชิ้นค่อยผูกเข้าล็อตทีหลัง
 * ผ่าน POST /fabric-items (fabricLotId) เพราะของจริงอาจยังไม่มี RFID tag ติดตอนสั่งซื้อ
 */
export const createLot = asyncHandler(async (req, res) => {
  if (req.auth.role === 'OPERATOR') {
    const allowed = await hasAnyPermission(
      req.auth.userId,
      'OPERATOR',
      permKeysForLegacy('fabric.lot.create')
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เพิ่มล็อตผ้า กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const { lotCode, purchasedAt, quantity, fabricCategoryId, maxWashCycles, maxUsageMonths } = req.body;
  const result = await scopedQuery(pool, tenantId).insert('fabric_lots', {
    lot_code: lotCode,
    purchased_at: purchasedAt ?? null,
    quantity,
    fabric_category_id: fabricCategoryId ?? null,
    max_wash_cycles: maxWashCycles ?? null,
    max_usage_months: maxUsageMonths ?? null,
    created_by: req.auth.userId,
  });

  return res.status(201).json({ id: result.insertId, lotCode, quantity });
});
