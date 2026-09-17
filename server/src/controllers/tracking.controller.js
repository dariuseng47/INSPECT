import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { getStuckItems } from '../utils/alerts.js';
import { resolveTenantId } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// current_location_type เป็น polymorphic ref ('CABINET' | 'DEVICE' | 'CENTRAL_STOCK')
// ดู docs/data-model.md — resolve เป็นชื่ออ่านง่ายสำหรับหน้า Location Search บนมือถือ
async function resolveLocationName(locationType, locationId) {
  if (locationType === 'CABINET' && locationId) {
    const [rows] = await pool.query(
      `SELECT cabinets.name AS cabinet_name, departments.name AS department_name
       FROM cabinets
       JOIN departments ON departments.id = cabinets.department_id
       WHERE cabinets.id = ?`,
      [locationId]
    );
    if (rows[0]) {
      return `ตู้ ${rows[0].cabinet_name} — ${rows[0].department_name}`;
    }
    return null;
  }

  if (locationType === 'DEVICE' && locationId) {
    const [rows] = await pool.query('SELECT device_type FROM devices WHERE id = ?', [locationId]);
    return rows[0] ? `อุปกรณ์ ${rows[0].device_type}` : null;
  }

  if (locationType === 'CENTRAL_STOCK') {
    return 'คลังกลาง';
  }

  return null;
}

/**
 * GET /api/v1/tracking/location/:epc — ค้นหาตำแหน่งล่าสุดของผ้าจาก EPC (ทุก role)
 */
export const getLocationByEpc = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const items = await scopedQuery(pool, tenantId).select('fabric_items', {
    epc_code: req.params.epc,
  });
  const item = items[0];
  if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบผ้ารหัสนี้');

  const locationName = await resolveLocationName(item.current_location_type, item.current_location_id);

  const lastScans = await scopedQuery(pool, tenantId).select('scan_logs', { fabric_item_id: item.id });
  lastScans.sort((a, b) => new Date(b.scanned_at) - new Date(a.scanned_at));

  return res.json({
    fabricItem: { id: item.id, epcCode: item.epc_code, status: item.status },
    location: {
      type: item.current_location_type,
      id: item.current_location_id,
      name: locationName,
    },
    lastScan: lastScans[0] ?? null,
  });
});

/**
 * GET /api/v1/tracking/process-status — ทุก role (Process Status Monitor, initial load)
 * ภาพรวมจำนวนผ้าต่อสถานะทั้งหมด + รายการผ้าที่ค้างสถานะเกินเวลาที่ตั้งไว้ใน status_timeout_settings
 * ("ค้างสถานะ" ประมาณจาก fabric_items.updated_at เพราะยังไม่มีคอลัมน์ status_changed_at แยก
 * — ตาม Advanced_Feature_Details&Rules.md หัวข้อ C. Sequence Exception & Timeout Monitoring)
 */
export const getProcessStatus = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [statusCounts] = await pool.query(
    `SELECT status, COUNT(*) AS count FROM fabric_items
     WHERE hospital_id = ? AND deleted_at IS NULL GROUP BY status`,
    [tenantId]
  );

  const stuckItems = await getStuckItems(tenantId);

  return res.json({ statusCounts, stuckItems });
});
