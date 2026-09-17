// ฟังก์ชันล้วน (pure) สำหรับจัดกลุ่ม/รวมยอดข้อมูลตึก+วอร์ด — แยกออกจาก
// restock-building-summary-card.jsx เพื่อให้ไฟล์ component ไม่ยาวเกินไป และเทสต์ตรงๆ ได้ง่ายขึ้น

// ----------------------------------------------------------------------

// จัดกลุ่มแถว building+category ที่ได้จาก server (flat list) ให้เป็น 1 ก้อนต่อตึก
export function groupByBuilding(summaryByBuilding) {
  const map = new Map();
  summaryByBuilding.forEach((row) => {
    const key = row.buildingId ?? 'none';
    if (!map.has(key)) {
      map.set(key, { buildingId: row.buildingId, buildingName: row.buildingName, rows: [] });
    }
    map.get(key).rows.push(row);
  });
  return [...map.values()].sort((a, b) => a.buildingName.localeCompare(b.buildingName, 'th'));
}

// จัดกลุ่ม summaryByWard (มี buildingId ติดมาจาก server แล้ว) เป็น Map<buildingId, wardGroup[]> —
// ใช้ตอน export Excel ที่ต้องมีชีตย่อยระดับวอร์ดของตึกที่เลือกด้วย
export function groupWardsByBuilding(summaryByWard) {
  const byBuilding = new Map();
  summaryByWard.forEach((row) => {
    const bKey = row.buildingId ?? 'none';
    if (!byBuilding.has(bKey)) byBuilding.set(bKey, new Map());
    const wardMap = byBuilding.get(bKey);
    const wKey = row.wardName;
    if (!wardMap.has(wKey)) wardMap.set(wKey, { wardName: wKey, total: 0, categories: [] });
    const group = wardMap.get(wKey);
    group.total += row.count;
    group.categories.push(row);
  });
  const result = new Map();
  byBuilding.forEach((wardMap, bKey) => {
    result.set(bKey, [...wardMap.values()].sort((a, b) => b.total - a.total));
  });
  return result;
}

export function computeTotals(rows) {
  return rows.reduce(
    (acc, r) => ({
      parQty: acc.parQty + r.parQty,
      restockedQty: acc.restockedQty + r.restockedQty,
      onWardQty: acc.onWardQty + r.onWardQty,
      totalQty: acc.totalQty + r.totalQty,
    }),
    { parQty: 0, restockedQty: 0, onWardQty: 0, totalQty: 0 }
  );
}

// รวมยอดข้ามตึก แยกตามชนิดผ้า — ใช้เป็นชีตสรุปท้ายสุดตอน export Excel เมื่อเลือกหลายตึก/ทั้งหมด
export function computeCombinedByCategory(displayedBuildings) {
  const map = new Map();
  displayedBuildings.forEach((b) => {
    b.rows.forEach((r) => {
      if (!map.has(r.categoryName)) {
        map.set(r.categoryName, {
          categoryName: r.categoryName,
          parQty: 0,
          restockedQty: 0,
          onWardQty: 0,
          totalQty: 0,
        });
      }
      const entry = map.get(r.categoryName);
      entry.parQty += r.parQty;
      entry.restockedQty += r.restockedQty;
      entry.onWardQty += r.onWardQty;
      entry.totalQty += r.totalQty;
    });
  });
  return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
}

// ภาพรวม 1 แถว/วอร์ด (ยอดรวมทุกชนิดผ้า) กรุ๊ปเป็นตึกๆ — ใช้ร่วมกันทั้ง export Excel (ชีต "สรุปวอร์ด")
// และ PDF (หน้า "สรุปวอร์ด") กันตรรกะจัดกลุ่มเพี้ยนกันระหว่างสองฝั่ง
// คืนค่า { sections: [{ buildingName, wards: [{wardName,count,transferCount}] }], grandTotal }
export function buildWardOverviewSections(displayedBuildings, wardsByBuildingId) {
  const sections = [];
  let grandCount = 0;
  let grandTransfer = 0;
  displayedBuildings.forEach((building) => {
    const wardGroups = wardsByBuildingId.get(building.buildingId ?? 'none') ?? [];
    const wards = wardGroups.map((group) => {
      const transferTotal = group.categories.reduce((sum, c) => sum + c.transferCount, 0);
      grandCount += group.total;
      grandTransfer += transferTotal;
      return { wardName: group.wardName, count: group.total, transferCount: transferTotal };
    });
    sections.push({ buildingName: building.buildingName, wards });
  });
  return { sections, grandTotal: { count: grandCount, transferCount: grandTransfer } };
}

// สรุปรวมข้ามตึก แยกตามชนิดผ้า พร้อม totals/percentage สำเร็จรูป — ใช้ทั้ง Excel และ PDF
export function buildCombinedSummary(displayedBuildings) {
  const rows = computeCombinedByCategory(displayedBuildings);
  const totals = computeTotals(rows);
  const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;
  return { rows, totals, totalPct };
}

// สร้างชุด sheet ทั้งหมดสำหรับ export Excel
// ลำดับ: 1) ชีตต่อตึก 2) ชีตภาพรวม "สรุปวอร์ด" (กรุ๊ปเป็นตึกๆ) 3) ชีตรายวอร์ด 4) ชีตสรุปรวมข้ามตึก
export function buildBuildingExcelSheets({ displayedBuildings, wardsByBuildingId, hospitalName, rangeLabel, scopeLabel }) {
  const sheets = [];
  const commonSubtitle = [hospitalName, rangeLabel ? `ช่วงเวลา ${rangeLabel}` : ''].filter(Boolean).join(' · ');

  displayedBuildings.forEach((building) => {
    const totals = computeTotals(building.rows);
    const totalPct = totals.parQty > 0 ? (totals.totalQty / totals.parQty) * 100 : null;
    const buildingRows = [
      ...building.rows.map((r) => ({
        categoryName: r.categoryName,
        parQty: r.parQty,
        restockedQty: r.restockedQty,
        onWardQty: r.onWardQty,
        totalQty: r.totalQty,
        pctLabel: '',
      })),
      {
        categoryName: 'รวมจำนวนทั้งหมด',
        parQty: totals.parQty,
        restockedQty: totals.restockedQty,
        onWardQty: totals.onWardQty,
        totalQty: totals.totalQty,
        pctLabel: totalPct === null ? '—' : `${totalPct.toFixed(1)}%`,
      },
    ];
    sheets.push({
      sheetName: `ตึก${building.buildingName}`,
      title: `รายงานการเติมสต๊อก ตึก${building.buildingName}`,
      subtitle: commonSubtitle,
      columns: [
        { key: 'categoryName', label: 'รายการ', width: 200 },
        { key: 'parQty', label: 'จำนวนสต็อค (Par)' },
        { key: 'restockedQty', label: 'จำนวนที่เติม' },
        { key: 'onWardQty', label: 'จำนวนสต็อคบนวอร์ด' },
        { key: 'totalQty', label: 'รวมทั้งหมด' },
        { key: 'pctLabel', label: '% เทียบเป้าหมาย' },
      ],
      rows: buildingRows,
      totalRowIndexes: [buildingRows.length - 1],
    });
  });

  // ภาพรวม 1 แถว/วอร์ด (ยอดรวมทุกชนิดผ้า ไม่แยกรายชนิด) กรุ๊ปเป็นตึกๆ ด้วยแถวคั่นหัวข้อตึก
  // ปิดท้ายด้วยยอดรวมทั้งหมดทุกวอร์ดทุกตึกที่เลือก
  const { sections: wardSections, grandTotal: wardGrandTotal } = buildWardOverviewSections(
    displayedBuildings,
    wardsByBuildingId
  );
  const wardOverviewRows = [];
  const wardOverviewSectionIndexes = [];
  wardSections.forEach((section) => {
    wardOverviewSectionIndexes.push(wardOverviewRows.length);
    wardOverviewRows.push({ sectionLabel: `ตึก${section.buildingName}` });
    section.wards.forEach((w) => wardOverviewRows.push(w));
  });
  const wardOverviewTotalIndex = wardOverviewRows.length;
  wardOverviewRows.push({
    wardName: 'ยอดรวมทุกวอร์ด',
    count: wardGrandTotal.count,
    transferCount: wardGrandTotal.transferCount,
  });
  sheets.push({
    sheetName: 'สรุปวอร์ด',
    title: `สรุปวอร์ด — ${scopeLabel}`,
    subtitle: commonSubtitle,
    columns: [
      { key: 'wardName', label: 'วอร์ด', width: 240 },
      { key: 'count', label: 'จำนวนที่เติมรวม' },
      { key: 'transferCount', label: 'โอนข้ามตู้รวม' },
    ],
    rows: wardOverviewRows,
    sectionRowIndexes: wardOverviewSectionIndexes,
    totalRowIndexes: [wardOverviewTotalIndex],
  });

  // รายละเอียดแยกตามชนิดผ้าของแต่ละวอร์ด (1 ชีต/วอร์ด)
  displayedBuildings.forEach((building) => {
    const wardGroups = wardsByBuildingId.get(building.buildingId ?? 'none') ?? [];
    wardGroups.forEach((group) => {
      const wardRows = [
        ...group.categories.map((c) => ({
          categoryName: c.categoryName,
          count: c.count,
          transferCount: c.transferCount,
        })),
        {
          categoryName: 'รวม',
          count: group.total,
          transferCount: group.categories.reduce((sum, c) => sum + c.transferCount, 0),
        },
      ];
      sheets.push({
        sheetName: group.wardName,
        title: `สรุปการเติมผ้า — ${group.wardName} (ตึก${building.buildingName})`,
        subtitle: commonSubtitle,
        columns: [
          { key: 'categoryName', label: 'หมวดหมู่ผ้า', width: 200 },
          { key: 'count', label: 'จำนวนครั้งที่เติม' },
          { key: 'transferCount', label: 'โอนข้ามตู้' },
        ],
        rows: wardRows,
        totalRowIndexes: [wardRows.length - 1],
      });
    });
  });

  // สรุปรวมทุกตึกที่เลือก แยกตามชนิดผ้า + แถวรวมผ้าทั้งหมด
  const { rows: combined, totals: grandTotals, totalPct: grandPct } = buildCombinedSummary(displayedBuildings);
  const summaryRows = [
    ...combined.map((r) => ({
      categoryName: r.categoryName,
      parQty: r.parQty,
      restockedQty: r.restockedQty,
      onWardQty: r.onWardQty,
      totalQty: r.totalQty,
      pctLabel: '',
    })),
    {
      categoryName: 'รวมผ้าทั้งหมด',
      parQty: grandTotals.parQty,
      restockedQty: grandTotals.restockedQty,
      onWardQty: grandTotals.onWardQty,
      totalQty: grandTotals.totalQty,
      pctLabel: grandPct === null ? '—' : `${grandPct.toFixed(1)}%`,
    },
  ];
  sheets.push({
    sheetName: 'สรุปรวมทุกตึก',
    title: `สรุปรวม${scopeLabel} — แยกตามชนิดผ้า`,
    subtitle: commonSubtitle,
    columns: [
      { key: 'categoryName', label: 'รายการ', width: 200 },
      { key: 'parQty', label: 'จำนวนสต็อค (Par)' },
      { key: 'restockedQty', label: 'จำนวนที่เติม' },
      { key: 'onWardQty', label: 'จำนวนสต็อคบนวอร์ด' },
      { key: 'totalQty', label: 'รวมทั้งหมด' },
      { key: 'pctLabel', label: '% เทียบเป้าหมาย' },
    ],
    rows: summaryRows,
    totalRowIndexes: [summaryRows.length - 1],
  });

  return sheets;
}
