import { pool } from '../db/pool.js';
import { resolveTenantId } from '../utils/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// รายงาน "การเติมผ้าเข้าตู้ประจำวอร์ด" — สร้างจาก scan_logs (event_type='WARD_ISSUE') ที่มีอยู่แล้ว
// ทุกครั้งที่มีการจ่ายผ้าไปตู้ (ทั้งจากหน้าเว็บและ handheld ในอนาคต เพราะยิงผ่าน endpoint เดียวกันคือ
// POST /scans/ward-issue) โดย metadata.cabinetId ถูกเพิ่มเข้ามาใน scan_logs ตั้งแต่ commit นี้เป็นต้นไป
// (ดู scans.controller.js#wardIssue) — เหตุการณ์ก่อนหน้านี้จะไม่มี cabinetId ในรายงาน
//
// metadata.isTransfer = true หมายถึงผ้าชิ้นนั้นอยู่ในตู้อื่นอยู่แล้วตอนถูก ward-issue ซ้ำ (เช่น เจอผ้า
// ข้ามตู้ตอนตรวจนับแล้วโอนเข้าตู้ที่ถูกต้อง) แยกนับจากการเติมผ้าใหม่จากสต๊อกกลางตามปกติ

function buildDateRange(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: startDate || today,
    to: endDate || today,
  };
}

async function fetchHistory(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT sl.id, sl.scanned_at, sl.metadata, sl.round_id,
            fi.epc_code,
            fc.id AS category_id, fc.name AS category_name,
            u.full_name AS user_name,
            c.id AS cabinet_id, c.name AS cabinet_name,
            d.id AS ward_id, d.name AS ward_name
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     LEFT JOIN users u ON u.id = sl.user_id
     LEFT JOIN cabinets c ON c.id = JSON_UNQUOTE(JSON_EXTRACT(sl.metadata, '$.cabinetId'))
     LEFT JOIN departments d ON d.id = c.department_id
     WHERE sl.hospital_id = ? AND sl.event_type = 'WARD_ISSUE'
       AND sl.scanned_at BETWEEN ? AND ?
     ORDER BY sl.scanned_at DESC
     LIMIT 1000`,
    [tenantId, `${from} 00:00:00`, `${to} 23:59:59`]
  );

  return rows.map((row) => ({
    id: row.id,
    scannedAt: row.scanned_at,
    epcCode: row.epc_code,
    categoryId: row.category_id,
    categoryName: row.category_name ?? 'ไม่ระบุหมวดหมู่',
    userName: row.user_name ?? '—',
    cabinetId: row.cabinet_id,
    cabinetName: row.cabinet_name ?? 'ไม่ทราบตู้ (บันทึกก่อนมีระบบติดตามตู้)',
    wardId: row.ward_id,
    wardName: row.ward_name ?? 'ไม่ทราบวอร์ด',
    isTransfer: !!row.metadata?.isTransfer,
    roundId: row.round_id,
  }));
}

// "รอบ" = 1 ครั้งที่ตรวจนับตู้ผ้า (cabinet-audit) แล้วตามด้วยการจ่ายผ้าเข้าตู้ — สร้างโดย
// scans.controller.js#cabinetAudit ทุกครั้ง ระบบ handheld/เว็บฝั่งไหนก็ผูกเข้ารอบเดียวกันได้ผ่าน
// roundId เดียวกันตอนเรียก ward-issue ตามมา (ดู scans.controller.js#wardIssue)
async function fetchRounds(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT r.id, r.created_at,
            c.id AS cabinet_id, c.name AS cabinet_name,
            d.id AS ward_id, d.name AS ward_name,
            u.full_name AS user_name,
            COUNT(sl.id) AS item_count
     FROM ward_issue_rounds r
     JOIN cabinets c ON c.id = r.cabinet_id
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN scan_logs sl ON sl.round_id = r.id AND sl.event_type = 'WARD_ISSUE'
     WHERE r.hospital_id = ? AND r.created_at BETWEEN ? AND ?
     GROUP BY r.id, r.created_at, c.id, c.name, d.id, d.name, u.full_name
     ORDER BY r.created_at DESC
     LIMIT 500`,
    [tenantId, `${from} 00:00:00`, `${to} 23:59:59`]
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    cabinetId: row.cabinet_id,
    cabinetName: row.cabinet_name,
    wardId: row.ward_id,
    wardName: row.ward_name ?? 'ไม่ทราบวอร์ด',
    userName: row.user_name ?? '—',
    itemCount: Number(row.item_count),
  }));
}

// แนบ buildingId/buildingName ให้แต่ละแถวด้วย (เดินขึ้น wardId -> ตึกต้นสังกัด) เพื่อให้ฝั่งหน้าเว็บ
// จัดกลุ่มวอร์ดเข้าตึกได้เอง — ใช้ตอน export Excel ของแท็บ "สรุปตามตึก" ที่ต้องมีชีตย่อยระดับวอร์ด
// ของตึกที่เลือกด้วย (ดู restock-building-summary-card.jsx)
function buildSummaryByWard(history, wardToBuilding) {
  const map = new Map();
  for (const row of history) {
    const key = `${row.wardId ?? 'none'}::${row.categoryId ?? 'none'}`;
    if (!map.has(key)) {
      const building = wardToBuilding.get(row.wardId) ?? { buildingId: null, buildingName: null };
      map.set(key, {
        wardId: row.wardId,
        wardName: row.wardName,
        buildingId: building.buildingId,
        buildingName: building.buildingName,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        count: 0,
        transferCount: 0,
      });
    }
    const entry = map.get(key);
    entry.count += 1;
    if (row.isTransfer) entry.transferCount += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// วอร์ด (department level_type='WARD') ผูกกับ "ตึก" ผ่านลำดับชั้นบังคับ WARD -> FLOOR -> BUILDING
// (ดู departments.controller.js#REQUIRED_PARENT_LEVEL) เดินขึ้น parent_id 2 ชั้นเพื่อหาตึกต้นสังกัด
async function fetchWardToBuildingMap(tenantId) {
  const [rows] = await pool.query(
    `SELECT id, parent_id, level_type, name FROM departments
     WHERE hospital_id = ? AND deleted_at IS NULL`,
    [tenantId]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const map = new Map();
  rows
    .filter((r) => r.level_type === 'WARD')
    .forEach((ward) => {
      const floor = byId.get(ward.parent_id);
      const building = floor ? byId.get(floor.parent_id) : null;
      map.set(ward.id, {
        buildingId: building?.id ?? null,
        buildingName: building?.name ?? 'ไม่ทราบตึก',
      });
    });
  return map;
}

// เหตุการณ์จ่ายผ้าเข้าตู้ทั้งหมดในช่วงวันที่ (ไม่ตัด LIMIT เหมือน fetchHistory เพราะรายงานตามตึก
// ต้องนับให้ครบทุกชิ้น ไม่ใช่แค่ 1000 รายการล่าสุดสำหรับตารางประวัติ)
async function fetchWardIssueForBuilding(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT fi.fabric_category_id AS category_id, fc.name AS category_name,
            c.department_id AS ward_id, sl.metadata
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     LEFT JOIN cabinets c ON c.id = JSON_UNQUOTE(JSON_EXTRACT(sl.metadata, '$.cabinetId'))
     WHERE sl.hospital_id = ? AND sl.event_type = 'WARD_ISSUE'
       AND sl.scanned_at BETWEEN ? AND ?`,
    [tenantId, `${from} 00:00:00`, `${to} 23:59:59`]
  );
  return rows;
}

// ปริมาณผ้าที่อยู่บนตู้ (วอร์ด) ตอนนี้จริงๆ แยกตามตู้ + หมวดหมู่ — สูตรเดียวกับ alerts.controller.js
async function fetchCabinetCurrentQty(tenantId) {
  const [rows] = await pool.query(
    `SELECT c.department_id AS ward_id, fi.fabric_category_id AS category_id,
            fc.name AS category_name, COUNT(*) AS qty
     FROM fabric_items fi
     JOIN cabinets c ON c.id = fi.current_location_id AND fi.current_location_type = 'CABINET'
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE fi.hospital_id = ? AND fi.deleted_at IS NULL
     GROUP BY c.department_id, fi.fabric_category_id, fc.name`,
    [tenantId]
  );
  return rows;
}

// เป้าหมายสต็อค (par level) ต่อตู้ + หมวดหมู่ — ตั้งค่าไว้ในหน้า "โครงสร้างโรงพยาบาล" ต่อตู้
async function fetchCabinetParLevels(tenantId) {
  const [rows] = await pool.query(
    `SELECT c.department_id AS ward_id, cpl.fabric_category_id AS category_id,
            fc.name AS category_name, cpl.par_level_qty
     FROM cabinet_par_levels cpl
     JOIN cabinets c ON c.id = cpl.cabinet_id AND c.deleted_at IS NULL
     JOIN fabric_categories fc ON fc.id = cpl.fabric_category_id
     WHERE c.hospital_id = ?`,
    [tenantId]
  );
  return rows;
}

// รวมยอดของทุกวอร์ดในตึกเดียวกันเข้าด้วยกัน ตามแบบรายงาน "การเติมสต๊อก [ตึก] ประจำเดือน" —
// รวมทั้งหมด = จำนวนที่เติม + จำนวนสต็อคบนวอร์ด, คิดเป็นเปอร์เซ็นต์ = รวมทั้งหมด / จำนวนสต็อค (par level)
function buildSummaryByBuilding(wardIssueRows, cabinetQtyRows, parLevelRows, wardToBuilding) {
  const map = new Map();

  const ensure = (buildingId, buildingName, categoryId, categoryName) => {
    const key = `${buildingId ?? 'none'}::${categoryId ?? 'none'}`;
    if (!map.has(key)) {
      map.set(key, {
        buildingId,
        buildingName: buildingName ?? 'ไม่ทราบตึก',
        categoryId,
        categoryName: categoryName ?? 'ไม่ระบุหมวดหมู่',
        parQty: 0,
        restockedQty: 0,
        onWardQty: 0,
      });
    }
    return map.get(key);
  };

  const buildingOf = (wardId) =>
    wardToBuilding.get(wardId) ?? { buildingId: null, buildingName: 'ไม่ทราบตึก' };

  // จำนวนที่เติม — ไม่รวม "โอนย้ายข้ามตู้" เพราะไม่ใช่การเติมผ้าใหม่จากสต๊อกกลาง
  wardIssueRows
    .filter((row) => !row.metadata?.isTransfer)
    .forEach((row) => {
      const building = buildingOf(row.ward_id);
      const entry = ensure(building.buildingId, building.buildingName, row.category_id, row.category_name);
      entry.restockedQty += 1;
    });

  cabinetQtyRows.forEach((row) => {
    const building = buildingOf(row.ward_id);
    const entry = ensure(building.buildingId, building.buildingName, row.category_id, row.category_name);
    entry.onWardQty += Number(row.qty);
  });

  parLevelRows.forEach((row) => {
    const building = buildingOf(row.ward_id);
    const entry = ensure(building.buildingId, building.buildingName, row.category_id, row.category_name);
    entry.parQty += Number(row.par_level_qty);
  });

  return [...map.values()]
    .map((row) => {
      const totalQty = row.restockedQty + row.onWardQty;
      return {
        ...row,
        totalQty,
        achievedPct: row.parQty > 0 ? Math.round((totalQty / row.parQty) * 1000) / 10 : null,
      };
    })
    .sort(
      (a, b) =>
        a.buildingName.localeCompare(b.buildingName, 'th') || b.totalQty - a.totalQty
    );
}

async function fetchDailyChart(tenantId) {
  const [rows] = await pool.query(
    `SELECT DATE(sl.scanned_at) AS day, fc.id AS category_id, fc.name AS category_name, COUNT(*) AS cnt
     FROM scan_logs sl
     JOIN fabric_items fi ON fi.id = sl.fabric_item_id
     LEFT JOIN fabric_categories fc ON fc.id = fi.fabric_category_id
     WHERE sl.hospital_id = ? AND sl.event_type = 'WARD_ISSUE'
       AND sl.scanned_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
     GROUP BY DATE(sl.scanned_at), fc.id, fc.name
     ORDER BY day ASC`,
    [tenantId]
  );

  // สร้างแกนวัน 30 วันย้อนหลังให้ครบทุกวัน (แม้วันไหนไม่มีข้อมูลเลยก็ต้องมีแท่ง = 0 ไว้)
  const days = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const categoryNames = [...new Set(rows.map((r) => r.category_name ?? 'ไม่ระบุหมวดหมู่'))];

  const countByDayCategory = new Map();
  for (const row of rows) {
    const day = row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day);
    const catName = row.category_name ?? 'ไม่ระบุหมวดหมู่';
    countByDayCategory.set(`${day}::${catName}`, Number(row.cnt));
  }

  const series = categoryNames.map((name) => ({
    name,
    data: days.map((day) => countByDayCategory.get(`${day}::${name}`) ?? 0),
  }));

  return { days, series };
}

function buildForecast(dailyChart) {
  const { days, series } = dailyChart;
  const numDays = days.length || 1;

  return series
    .map((s) => {
      const total = s.data.reduce((sum, v) => sum + v, 0);
      const avgPerDay = total / numDays;

      // เทียบค่าเฉลี่ยครึ่งแรก vs ครึ่งหลังของ 30 วัน เพื่อดูแนวโน้มคร่าวๆ
      const half = Math.floor(numDays / 2);
      const firstHalfAvg = s.data.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
      const secondHalfAvg = s.data.slice(half).reduce((a, b) => a + b, 0) / (numDays - half || 1);
      let trend = 'คงที่';
      if (secondHalfAvg > firstHalfAvg * 1.15) trend = 'เพิ่มขึ้น';
      else if (secondHalfAvg < firstHalfAvg * 0.85) trend = 'ลดลง';

      return {
        categoryName: s.name,
        totalLast30Days: total,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        projectedNext7Days: Math.round(avgPerDay * 7),
        projectedNext30Days: Math.round(avgPerDay * 30),
        trend,
      };
    })
    .sort((a, b) => b.totalLast30Days - a.totalLast30Days);
}

/**
 * GET /api/v1/restock-report — ทุก role (อ่านอย่างเดียว)
 * ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD ใช้กรอง history/summaryByWard เท่านั้น —
 * dailyChart/forecast ใช้ 30 วันล่าสุดเสมอ ไม่ผูกกับตัวกรองวันที่ (คนละวัตถุประสงค์กัน)
 */
export const getRestockReport = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const { from, to } = buildDateRange(req.query.startDate, req.query.endDate);

  const [history, wardToBuilding, wardIssueRows, cabinetQtyRows, parLevelRows] = await Promise.all([
    fetchHistory(tenantId, from, to),
    fetchWardToBuildingMap(tenantId),
    fetchWardIssueForBuilding(tenantId, from, to),
    fetchCabinetCurrentQty(tenantId),
    fetchCabinetParLevels(tenantId),
  ]);
  const summaryByWard = buildSummaryByWard(history, wardToBuilding);
  const rounds = await fetchRounds(tenantId, from, to);
  const dailyChart = await fetchDailyChart(tenantId);
  const forecast = buildForecast(dailyChart);

  const summaryByBuilding = buildSummaryByBuilding(wardIssueRows, cabinetQtyRows, parLevelRows, wardToBuilding);

  const totals = {
    totalEvents: history.length,
    totalTransfers: history.filter((h) => h.isTransfer).length,
    totalRounds: rounds.length,
  };

  return res.json({
    range: { from, to },
    totals,
    history,
    summaryByWard,
    summaryByBuilding,
    rounds,
    dailyChart,
    forecast,
  });
});
