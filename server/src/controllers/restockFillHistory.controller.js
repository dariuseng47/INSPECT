import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// แท็บ "ประวัติยอดการเติมผ้า" — ตารางแยกรายวัน (วอร์ด x ชนิดผ้า) แนะนำ/สแกน/เติม/หลังเติม
// แยกไฟล์จาก restockReport.controller.js เพราะเป็นคนละมุมมอง: ต่างจาก summaryByBuilding ตรงที่ต้อง
// แยกเป็นรายวัน + "สแกนได้"/"แนะนำ" อิงจากสต็อกจริงตอนตรวจนับแต่ละรอบ (ไม่ใช่สต็อกปัจจุบัน ณ ตอนเรียก
// API เหมือน fetchCabinetCurrentQty ของ restockReport.controller.js)

function buildDateTimeRange(startDateTime, endDateTime) {
  const today = new Date().toISOString().slice(0, 10);
  const withDefaultTime = (v, fallbackTime) => {
    const value = v || `${today} ${fallbackTime}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value} ${fallbackTime}` : value;
  };
  return {
    from: withDefaultTime(startDateTime, '00:00:00'),
    to: withDefaultTime(endDateTime, '23:59:59'),
  };
}

// วอร์ดทั้งหมดของ tenant พร้อมตึกต้นสังกัด + sort_order (ใช้เรียงคอลัมน์ตามลำดับชั้นจริง เช่น ชั้น 4,5,6,7)
// โครงเดียวกับ fetchWardToBuildingMap ใน restockReport.controller.js แต่เก็บ wardName/sortOrder เพิ่ม
async function fetchWardDirectory(tenantId) {
  const [rows] = await pool.query(
    `SELECT id, parent_id, level_type, name, sort_order FROM departments
     WHERE hospital_id = ? AND deleted_at IS NULL`,
    [tenantId]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows
    .filter((r) => r.level_type === 'WARD')
    .map((ward) => {
      const floor = byId.get(ward.parent_id);
      const building = floor ? byId.get(floor.parent_id) : null;
      return {
        wardId: ward.id,
        wardName: ward.name,
        sortOrder: ward.sort_order,
        buildingId: building?.id ?? null,
        buildingName: building?.name ?? 'ไม่ทราบตึก',
      };
    });
}

// เลือกขอบเขตวอร์ด: ระบุ wardIds มาตรง ๆ ใช้เลย, ไม่ระบุแต่มี buildingId ใช้ทุกวอร์ดใต้ตึกนั้น,
// ไม่ระบุทั้งคู่ใช้ทุกวอร์ดของ tenant
function resolveScopeWards(wardDirectory, buildingId, wardIds) {
  if (wardIds && wardIds.length > 0) {
    const idSet = new Set(wardIds);
    return wardDirectory.filter((w) => idSet.has(w.wardId));
  }
  if (buildingId) {
    return wardDirectory.filter((w) => w.buildingId === buildingId);
  }
  return wardDirectory;
}

async function fetchCabinetsForWards(tenantId, wardIds) {
  if (wardIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT id AS cabinet_id, department_id AS ward_id FROM cabinets
     WHERE hospital_id = ? AND deleted_at IS NULL AND department_id IN (${wardIds.map(() => '?').join(',')})`,
    [tenantId, ...wardIds]
  );
  return rows;
}

async function fetchRoundsInScope(tenantId, cabinetIds, from, to) {
  if (cabinetIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT id, cabinet_id, created_at FROM ward_issue_rounds
     WHERE hospital_id = ? AND cabinet_id IN (${cabinetIds.map(() => '?').join(',')})
       AND created_at BETWEEN ? AND ?`,
    [tenantId, ...cabinetIds, from, to]
  );
  return rows;
}

async function fetchRoundScanLogs(roundIds) {
  if (roundIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT sl.round_id, sl.event_type, sl.metadata, fi.fabric_category_id AS category_id
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     WHERE sl.event_type IN ('CABINET_AUDIT', 'WARD_ISSUE')
       AND sl.round_id IN (${roundIds.map(() => '?').join(',')})`,
    roundIds
  );
  return rows;
}

async function fetchParLevelsForCabinets(cabinetIds) {
  if (cabinetIds.length === 0) return [];
  const [rows] = await pool.query(
    `SELECT cpl.cabinet_id, cpl.fabric_category_id AS category_id, cpl.par_level_qty, fc.name AS category_name
     FROM cabinet_par_levels cpl
     JOIN fabric_categories fc ON fc.id = cpl.fabric_category_id
     WHERE cpl.cabinet_id IN (${cabinetIds.map(() => '?').join(',')})`,
    cabinetIds
  );
  return rows;
}

// รวมข้อมูลรอบ (ward_issue_rounds) แยกตาม (วัน, วอร์ด, ชนิดผ้า) — แนะนำ/สแกน/เติม/หลังเติม
// "แนะนำ" คำนวณต่อรอบก่อนแล้วค่อยรวม (สูตรเดียวกับ reconciliation.shortageQty ใน
// scans.controller.js#cabinetAudit: par_level_qty - ยอดที่สแกนได้ตอนตรวจนับรอบนั้น) เพราะ par level
// เทียบกับสต็อกที่สแกนได้ตอนตรวจนับแต่ละรอบ ไม่ใช่ยอดสแกนรวมทั้งวัน
//
// เซลล์ (วัน,วอร์ด,ชนิดผ้า) ที่ไม่มี key ใน cells เลย หมายถึง "ไม่มีข้อมูล" (ตู้วอร์ดนั้นไม่ได้ตั้ง
// par level ของชนิดผ้านั้นไว้ หรือวันนั้นไม่มีรอบตรวจนับ/เติมผ้าเกิดขึ้นเลย) — ฝั่งหน้าเว็บแสดง "—" แทน
export function buildFillHistoryDays({ rounds, scanLogs, parLevelRows, cabinetToWard, scopeWards }) {
  const scannedByRound = new Map(); // roundId -> Map(categoryId -> count)
  const filledByRound = new Map(); // roundId -> Map(categoryId -> count)

  for (const log of scanLogs) {
    if (log.category_id == null) continue; // eslint-disable-line no-continue
    if (log.event_type === 'WARD_ISSUE' && log.metadata?.isTransfer) continue; // eslint-disable-line no-continue
    const target = log.event_type === 'CABINET_AUDIT' ? scannedByRound : filledByRound;
    if (!target.has(log.round_id)) target.set(log.round_id, new Map());
    const counts = target.get(log.round_id);
    counts.set(log.category_id, (counts.get(log.category_id) || 0) + 1);
  }

  const parLevelsByCabinet = new Map(); // cabinetId -> [{categoryId, parLevelQty}]
  const categoryNameById = new Map();
  for (const row of parLevelRows) {
    if (!parLevelsByCabinet.has(row.cabinet_id)) parLevelsByCabinet.set(row.cabinet_id, []);
    parLevelsByCabinet
      .get(row.cabinet_id)
      .push({ categoryId: row.category_id, parLevelQty: Number(row.par_level_qty) });
    categoryNameById.set(row.category_id, row.category_name);
  }

  const dayMap = new Map(); // 'YYYY-MM-DD' -> Map('catId::wardId' -> {recommendedQty, scannedQty, filledQty})

  for (const round of rounds) {
    const wardId = cabinetToWard.get(round.cabinet_id);
    const configured = parLevelsByCabinet.get(round.cabinet_id) || [];
    if (!wardId || configured.length === 0) continue; // eslint-disable-line no-continue

    const day =
      round.created_at instanceof Date
        ? round.created_at.toISOString().slice(0, 10)
        : String(round.created_at).slice(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, new Map());
    const cells = dayMap.get(day);

    const roundScanned = scannedByRound.get(round.id) || new Map();
    const roundFilled = filledByRound.get(round.id) || new Map();

    for (const { categoryId, parLevelQty } of configured) {
      const scannedInRound = roundScanned.get(categoryId) || 0;
      const filledInRound = roundFilled.get(categoryId) || 0;
      const recommendedInRound = Math.max(parLevelQty - scannedInRound, 0);

      const key = `${categoryId}::${wardId}`;
      if (!cells.has(key)) cells.set(key, { recommendedQty: 0, scannedQty: 0, filledQty: 0 });
      const cell = cells.get(key);
      cell.recommendedQty += recommendedInRound;
      cell.scannedQty += scannedInRound;
      cell.filledQty += filledInRound;
    }
  }

  const days = [...dayMap.keys()].sort().map((date) => ({
    date,
    cells: Object.fromEntries(
      [...dayMap.get(date).entries()].map(([key, v]) => [
        key,
        { ...v, afterFillQty: v.scannedQty + v.filledQty },
      ])
    ),
  }));

  const categoryIds = [...new Set(parLevelRows.map((r) => r.category_id))];
  const categories = categoryIds
    .map((id) => ({ id, name: categoryNameById.get(id) ?? 'ไม่ระบุหมวดหมู่' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const wards = [...scopeWards]
    .sort(
      (a, b) =>
        a.buildingName.localeCompare(b.buildingName, 'th') ||
        a.sortOrder - b.sortOrder ||
        a.wardName.localeCompare(b.wardName, 'th')
    )
    .map((w) => ({ id: w.wardId, name: w.wardName, buildingId: w.buildingId, buildingName: w.buildingName }));

  return { days, wards, categories };
}

/**
 * GET /api/v1/restock-report/fill-history — ทุก role (อ่านอย่างเดียว)
 * ?startDateTime=YYYY-MM-DD HH:mm&endDateTime=...&buildingId=&wardIds=1,2,3
 */
export const getRestockFillHistory = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { from, to } = buildDateTimeRange(req.query.startDateTime, req.query.endDateTime);
  const { buildingId, wardIds } = req.query;

  const wardDirectory = await fetchWardDirectory(tenantId);
  const scopeWards = resolveScopeWards(wardDirectory, buildingId, wardIds);
  const scopeWardIds = scopeWards.map((w) => w.wardId);

  const cabinetRows = await fetchCabinetsForWards(tenantId, scopeWardIds);
  const cabinetIds = cabinetRows.map((r) => r.cabinet_id);
  const cabinetToWard = new Map(cabinetRows.map((r) => [r.cabinet_id, r.ward_id]));

  const [rounds, parLevelRows] = await Promise.all([
    fetchRoundsInScope(tenantId, cabinetIds, from, to),
    fetchParLevelsForCabinets(cabinetIds),
  ]);
  const scanLogs = await fetchRoundScanLogs(rounds.map((r) => r.id));

  const { days, wards, categories } = buildFillHistoryDays({
    rounds,
    scanLogs,
    parLevelRows,
    cabinetToWard,
    scopeWards,
  });

  return res.json({ range: { from, to }, days, wards, categories });
});
