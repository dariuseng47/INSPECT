import { pool } from '../db/pool.js';
import { getStuckItems } from '../utils/alerts.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/alerts — ทุก role (ดู docs/api-spec.md)
 * รวมแจ้งเตือน 5 ประเภทตาม Advanced_Feature_Details&Rules.md หัวข้อ A/C/E:
 * par level ต่ำ, ผ้าค้างสถานะเกินเวลา, สัญญาณอ่อนกว่าเกณฑ์, ข้ามขั้นตอน, อุปกรณ์ offline
 */
export const listAlerts = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const statusTimeout = await getStuckItems(tenantId);

  const [parLevel] = await pool.query(
    `SELECT cpl.cabinet_id, c.name AS cabinet_name, dept.name AS department_name,
            cpl.fabric_category_id, fc.name AS category_name,
            cpl.par_level_qty, cpl.warning_pct, COALESCE(cur.qty, 0) AS current_qty
     FROM cabinet_par_levels cpl
     JOIN cabinets c ON c.id = cpl.cabinet_id AND c.deleted_at IS NULL
     JOIN departments dept ON dept.id = c.department_id
     JOIN fabric_categories fc ON fc.id = cpl.fabric_category_id
     LEFT JOIN (
       SELECT current_location_id, fabric_category_id, COUNT(*) AS qty
       FROM fabric_items
       WHERE hospital_id = ? AND deleted_at IS NULL AND current_location_type = 'CABINET'
       GROUP BY current_location_id, fabric_category_id
     ) cur ON cur.current_location_id = cpl.cabinet_id AND cur.fabric_category_id = cpl.fabric_category_id
     WHERE c.hospital_id = ?
       AND COALESCE(cur.qty, 0) <= cpl.par_level_qty * cpl.warning_pct / 100
     ORDER BY current_qty ASC`,
    [tenantId, tenantId]
  );

  const [deviceOffline] = await pool.query(
    `SELECT id, device_type, caretaker_name, caretaker_phone, last_heartbeat_at
     FROM devices WHERE hospital_id = ? AND status = 'OFFLINE'`,
    [tenantId]
  );

  const [weakSignal] = await pool.query(
    `SELECT sl.id, sl.fabric_item_id, fi.epc_code, sl.device_id, d.device_type,
            sl.rssi_dbm, d.rssi_threshold_dbm, sl.scanned_at
     FROM scan_logs sl
     JOIN devices d ON d.id = sl.device_id
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     WHERE sl.hospital_id = ? AND sl.rssi_dbm IS NOT NULL AND sl.rssi_dbm < d.rssi_threshold_dbm
       AND sl.scanned_at >= NOW() - INTERVAL 24 HOUR
     ORDER BY sl.scanned_at DESC
     LIMIT 50`,
    [tenantId]
  );

  const [stepSkipped] = await pool.query(
    `SELECT sl.id, sl.fabric_item_id, fi.epc_code, sl.event_type, sl.scanned_at
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     WHERE sl.hospital_id = ? AND sl.is_step_skipped = TRUE
       AND sl.scanned_at >= NOW() - INTERVAL 7 DAY
     ORDER BY sl.scanned_at DESC
     LIMIT 50`,
    [tenantId]
  );

  return res.json({ statusTimeout, parLevel, deviceOffline, weakSignal, stepSkipped });
});
