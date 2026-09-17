// ฟังก์ชันล้วน (pure) สำหรับแท็บ "ประวัติยอดการเติมผ้า" — แยกออกจาก restock-fill-history-card.jsx
// เพื่อให้ไฟล์ component ไม่ยาวเกินไป และเทสต์ตรงๆ ได้ง่ายขึ้น (ตาม pattern เดียวกับ
// restock-building-summary-utils.js)

import { buildDepartmentTree } from 'src/sections/organization/organization-constants';

// ----------------------------------------------------------------------

const METRIC_COLUMNS = [
  { key: 'recommended', label: 'แนะนำ', field: 'recommendedQty' },
  { key: 'scanned', label: 'สแกน', field: 'scannedQty' },
  { key: 'filled', label: 'เติม', field: 'filledQty' },
  { key: 'afterFill', label: 'หลังเติม', field: 'afterFillQty' },
];

export function cellKey(categoryId, wardId) {
  return `${categoryId}::${wardId}`;
}

// ตึกทั้งหมดของโรงพยาบาล (จาก useGetDepartments ดิบ) — ใช้ทำ Autocomplete เลือกตึก
export function getBuildingOptions(departments) {
  return buildDepartmentTree(departments)
    .filter((node) => node.level_type === 'BUILDING')
    .map((b) => ({ id: b.id, name: b.name }));
}

function flattenWardsOfBuilding(buildingNode) {
  const wards = [];
  (buildingNode.children ?? []).forEach((floor) => {
    (floor.children ?? []).forEach((ward) => {
      if (ward.level_type === 'WARD') {
        wards.push({ id: ward.id, name: ward.name, buildingId: buildingNode.id, buildingName: buildingNode.name });
      }
    });
  });
  return wards;
}

// วอร์ดทั้งหมดใต้ตึกที่เลือก (หรือทุกตึกถ้าไม่ระบุ buildingId) — ใช้ทำ Autocomplete เลือกวอร์ด
export function getWardOptions(departments, buildingId) {
  const buildings = buildDepartmentTree(departments).filter((node) => node.level_type === 'BUILDING');
  const scoped = buildingId ? buildings.filter((b) => b.id === buildingId) : buildings;
  return scoped.flatMap(flattenWardsOfBuilding);
}

// สร้างชุด sheet Excel — 1 ชีต/1 วัน หัวตาราง 2 ชั้น (ชื่อวอร์ด merge ครอบ 4 คอลัมน์ย่อย:
// แนะนำ/สแกน/เติม/หลังเติม) แถวสุดท้ายเป็นผลรวมทุกชนิดผ้าต่อวอร์ด+คอลัมน์ย่อย
export function buildFillHistoryExcelSheets({ days, wards, categories, hospitalName, scopeLabel }) {
  const commonSubtitle = [hospitalName, scopeLabel].filter(Boolean).join(' · ');

  return days.map((day) => {
    const groupHeader = [
      { label: 'ชนิดผ้า', span: 1 },
      ...wards.map((w) => ({ label: w.name, span: METRIC_COLUMNS.length })),
    ];

    const columns = [
      { key: 'categoryName', label: 'ชนิดผ้า', width: 180 },
      ...wards.flatMap((w) => METRIC_COLUMNS.map((m) => ({ key: `${w.id}_${m.key}`, label: m.label }))),
    ];

    const totals = new Map(); // columnKey -> sum
    const rows = categories.map((cat) => {
      const row = { categoryName: cat.name };
      wards.forEach((w) => {
        const cell = day.cells[cellKey(cat.id, w.id)];
        METRIC_COLUMNS.forEach((m) => {
          const colKey = `${w.id}_${m.key}`;
          const value = cell ? cell[m.field] : null;
          row[colKey] = value === null ? '—' : value;
          if (value !== null) totals.set(colKey, (totals.get(colKey) ?? 0) + value);
        });
      });
      return row;
    });

    const totalRow = { categoryName: 'รวมทุกชนิดผ้า' };
    columns.forEach((c) => {
      if (c.key === 'categoryName') return;
      totalRow[c.key] = totals.has(c.key) ? totals.get(c.key) : '—';
    });
    rows.push(totalRow);

    return {
      sheetName: day.date,
      title: `ประวัติการเติมผ้า — ${day.date}`,
      subtitle: commonSubtitle,
      groupHeader,
      columns,
      rows,
      totalRowIndexes: [rows.length - 1],
    };
  });
}
