import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * GET /api/v1/wash-analytics — ทุก role
 * สรุปรอบซักตาม Advanced_Feature_Details&Rules.md หัวข้อ D. Master Fabric & Asset Management
 * เทียบ fabric_items.wash_count กับ "รอบซักสูงสุดที่มีผลจริง" ของแต่ละชิ้น ซึ่งผูกกับล็อตจัดซื้อก่อน
 * (fabric_lots.max_wash_cycles ถ้าตั้งไว้ตอนลงทะเบียนล็อต) แล้วค่อย fallback ไปใช้ค่า default ของ
 * หมวดหมู่ (fabric_categories.max_wash_cycles) ถ้าล็อตไม่ได้ override — COALESCE(lot, category)
 * ไม่ได้ตั้งทั้งคู่ = ไม่มีเกณฑ์เตือน (near/over เป็น NULL)
 */
export const getWashAnalytics = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const [categorySummary] = await pool.query(
    `SELECT fc.id AS category_id, fc.name AS category_name, fc.max_wash_cycles,
            COUNT(fi.id) AS item_count,
            ROUND(AVG(fi.wash_count), 1) AS avg_wash_count,
            SUM(CASE WHEN COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) IS NOT NULL
                     AND fi.wash_count >= COALESCE(fl.max_wash_cycles, fc.max_wash_cycles)
                     THEN 1 ELSE 0 END) AS over_threshold_count,
            SUM(CASE WHEN COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) IS NOT NULL
                     AND fi.wash_count >= COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) * 0.8
                     AND fi.wash_count < COALESCE(fl.max_wash_cycles, fc.max_wash_cycles)
                     THEN 1 ELSE 0 END) AS near_threshold_count
     FROM fabric_categories fc
     LEFT JOIN fabric_items fi
       ON fi.fabric_category_id = fc.id AND fi.hospital_id = fc.hospital_id AND fi.deleted_at IS NULL
     LEFT JOIN fabric_lots fl ON fl.id = fi.fabric_lot_id
     WHERE fc.hospital_id = ?
     GROUP BY fc.id, fc.name, fc.max_wash_cycles
     ORDER BY fc.name`,
    [tenantId]
  );

  const [topWornItems] = await pool.query(
    `SELECT fi.id, fi.epc_code, fc.name AS category_name, fi.wash_count,
            COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) AS max_wash_cycles,
            ROUND(fi.wash_count / COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) * 100, 0) AS pct_of_max
     FROM fabric_items fi
     JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     LEFT JOIN fabric_lots fl ON fl.id = fi.fabric_lot_id
     WHERE fi.hospital_id = ? AND fi.deleted_at IS NULL
       AND COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) IS NOT NULL
       AND COALESCE(fl.max_wash_cycles, fc.max_wash_cycles) > 0
     ORDER BY pct_of_max DESC
     LIMIT 10`,
    [tenantId]
  );

  return res.json({ categorySummary, topWornItems });
});
