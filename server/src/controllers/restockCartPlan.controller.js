import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// ============================================================================
// "จัดผ้าเข้ารถ" — แผนเติมผ้าประจำวอร์ด (ก่อนออกรอบ) สำหรับพนักงานเติมผ้า
//
// วิเคราะห์ "ทุกตู้ผ้า" ว่าตอนนี้น่าจะเหลือผ้าแต่ละหมวดหมู่กี่ชิ้น แล้วเทียบกับ par level
// ของตู้ เพื่อสรุปว่าต้องจัดผ้าขึ้นรถกี่ชิ้น (รายตู้ + สรุปรวมทั้งโรงพยาบาล)
//
// ที่มาของ "ผ้าที่น่าจะยังอยู่ในตู้ตอนนี้" (estimatedInCabinetQty):
//   = fabric_items ที่ระบบบันทึกว่า current_location = ตู้นั้น และ status ยังเป็น WARD_CABINET
//
//   ผ้าที่ "เคยสแกนเช็คตู้ (CABINET_AUDIT)" หรือ "สแกนเติมเข้าตู้ (WARD_ISSUE)" จะถูกตั้ง
//   current_location_type='CABINET' + current_location_id=<ตู้> + status='WARD_CABINET'
//   (ดู scans.controller.js#wardIssue) — พอผ้าถูกใช้แล้วและถูกสแกนรับคืน/เข้าโรงซัก/เข้าสต๊อค
//   หรือถูกเปลี่ยนสถานะด้วยมือเป็น WASH / CENTRAL_STOCK ระบบจะย้าย current_location ออกจากตู้
//   และเปลี่ยน status (ดู wardReceive / washReceiveBatch / statusChange) — ชิ้นพวกนี้จึงหลุด
//   จากการนับโดยอัตโนมัติ = "หักลบผ้าที่ถูกใช้ไปแล้ว" ตามที่ต้องการ
//
// ============================================================================

/**
 * GET /api/v1/restock-cart-plan — ต้องมีสิทธิ์เมนู web.operations.ward.view
 * ?hospitalId= (superadmin บังคับ)
 */
export const getRestockCartPlan = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);

  const emptyResponse = {
    generatedAt: new Date(),
    cabinets: [],
    summary: [],
    totals: { cabinetCount: 0, cabinetsNeedingRestock: 0, categoryCount: 0, totalSuggestedLoad: 0 },
  };

  // 1) ตู้ผ้าทั้งหมดของโรงพยาบาล + วอร์ดที่สังกัด
  const [cabinetRows] = await pool.query(
    `SELECT c.id, c.name, d.id AS ward_id, d.name AS ward_name
     FROM cabinets c
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE c.hospital_id = ? AND c.deleted_at IS NULL
     ORDER BY d.name, c.name`,
    [tenantId]
  );
  if (cabinetRows.length === 0) return res.json(emptyResponse);

  const cabinetIds = cabinetRows.map((c) => c.id);
  const placeholders = cabinetIds.map(() => '?').join(',');

  // 2) par level ราย ตู้/หมวดหมู่
  const [parRows] = await pool.query(
    `SELECT cpl.cabinet_id, cpl.fabric_category_id, cpl.par_level_qty,
            fc.name AS category_name
     FROM cabinet_par_levels cpl
     JOIN fabric_categories fc ON fc.id = cpl.fabric_category_id
     WHERE cpl.cabinet_id IN (${placeholders})`,
    cabinetIds
  );

  // 3) ผ้าที่น่าจะยังอยู่ในตู้ตอนนี้ ราย ตู้/หมวดหมู่
  const [onHandRows] = await pool.query(
    `SELECT fi.current_location_id AS cabinet_id, fi.fabric_category_id, COUNT(*) AS qty
     FROM fabric_items fi
     WHERE fi.hospital_id = ?
       AND fi.current_location_type = 'CABINET'
       AND fi.current_location_id IN (${placeholders})
       AND fi.status = 'WARD_CABINET'
       AND fi.deleted_at IS NULL
     GROUP BY fi.current_location_id, fi.fabric_category_id`,
    [tenantId, ...cabinetIds]
  );

  const onHandMap = new Map(); // `${cabinetId}::${categoryId}` -> qty
  for (const row of onHandRows) {
    onHandMap.set(`${row.cabinet_id}::${row.fabric_category_id}`, Number(row.qty));
  }

  const parByCabinet = new Map(); // cabinetId -> parRow[]
  for (const row of parRows) {
    if (!parByCabinet.has(row.cabinet_id)) parByCabinet.set(row.cabinet_id, []);
    parByCabinet.get(row.cabinet_id).push(row);
  }

  const summaryMap = new Map(); // categoryId -> aggregate

  const cabinets = cabinetRows.map((cab) => {
    const pars = parByCabinet.get(cab.id) ?? [];

    const lines = pars
      .map((p) => {
        const estimatedInCabinetQty = onHandMap.get(`${cab.id}::${p.fabric_category_id}`) ?? 0;
        const shortageQty = Math.max(p.par_level_qty - estimatedInCabinetQty, 0);
        const suggestedLoadQty = shortageQty;
        return {
          fabricCategoryId: p.fabric_category_id,
          categoryName: p.category_name,
          parLevelQty: p.par_level_qty,
          estimatedInCabinetQty,
          shortageQty,
          suggestedLoadQty,
        };
      })
      .sort(
        (a, b) =>
          b.suggestedLoadQty - a.suggestedLoadQty ||
          a.categoryName.localeCompare(b.categoryName, 'th')
      );

    let totalShortage = 0;
    let totalSuggestedLoad = 0;
    for (const line of lines) {
      totalShortage += line.shortageQty;
      totalSuggestedLoad += line.suggestedLoadQty;
      if (line.suggestedLoadQty > 0) {
        const agg = summaryMap.get(line.fabricCategoryId) ?? {
          fabricCategoryId: line.fabricCategoryId,
          categoryName: line.categoryName,
          totalShortage: 0,
          totalSuggestedLoad: 0,
          cabinetCount: 0,
        };
        agg.totalShortage += line.shortageQty;
        agg.totalSuggestedLoad += line.suggestedLoadQty;
        agg.cabinetCount += 1;
        summaryMap.set(line.fabricCategoryId, agg);
      }
    }

    return {
      cabinetId: cab.id,
      cabinetName: cab.name,
      wardId: cab.ward_id,
      wardName: cab.ward_name ?? 'ไม่ทราบวอร์ด',
      hasParConfig: pars.length > 0,
      lines,
      totalShortage,
      totalSuggestedLoad,
    };
  });

  const summary = [...summaryMap.values()].sort(
    (a, b) =>
      b.totalSuggestedLoad - a.totalSuggestedLoad ||
      a.categoryName.localeCompare(b.categoryName, 'th')
  );

  const totals = {
    cabinetCount: cabinets.length,
    cabinetsNeedingRestock: cabinets.filter((c) => c.totalSuggestedLoad > 0).length,
    categoryCount: summary.length,
    totalSuggestedLoad: summary.reduce((sum, c) => sum + c.totalSuggestedLoad, 0),
  };

  return res.json({ generatedAt: new Date(), cabinets, summary, totals });
});
