import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

Font.register({
  family: 'NotoSansThai',
  fonts: [
    { src: '/fonts/NotoSansThai-Regular.ttf' },
    { src: '/fonts/NotoSansThai-Bold.ttf', fontWeight: 700 },
  ],
});

const useStyles = () =>
  useMemo(
    () =>
      StyleSheet.create({
        page: {
          fontSize: 9,
          lineHeight: 1.6,
          fontFamily: 'NotoSansThai',
          backgroundColor: '#FFFFFF',
          padding: '32px 28px',
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottomWidth: 2,
          borderStyle: 'solid',
          borderColor: '#00A76F',
        },
        h1: { fontSize: 16, fontWeight: 700, color: '#00A76F' },
        h2: { fontSize: 11, fontWeight: 700, marginBottom: 6, marginTop: 14 },
        muted: { fontSize: 8, color: '#637381' },
        table: { display: 'flex', width: '100%', marginBottom: 4 },
        rowHead: {
          flexDirection: 'row',
          backgroundColor: '#F4F6F8',
          padding: '6px 4px',
        },
        row: {
          flexDirection: 'row',
          padding: '6px 4px',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowTotal: {
          flexDirection: 'row',
          padding: '6px 4px',
          backgroundColor: '#DFF3E8',
        },
        rowSection: {
          padding: '6px 4px',
          backgroundColor: '#EAEEF3',
        },
        cellHead: { fontSize: 8, fontWeight: 700, color: '#454F5B' },
        cell: { fontSize: 8, color: '#212B36' },
        cellTotal: { fontSize: 8, fontWeight: 700, color: '#1B806A' },
        cellSection: { fontSize: 8.5, fontWeight: 700, color: '#212B36' },
        footer: {
          position: 'absolute',
          bottom: 20,
          left: 28,
          right: 28,
          textAlign: 'center',
          fontSize: 7,
          color: '#919EAB',
        },
      }),
    []
  );

const COL = { name: '34%', num: '16.5%' };
const WARD_COL = { name: '55%', num: '22.5%' };

function ReportHeader({ styles, title, hospitalName, range }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.h1}>{title}</Text>
        {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
        <Text style={styles.muted}>
          ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : '-'}
        </Text>
      </View>
      <View>
        <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
      </View>
    </View>
  );
}

// ตารางแยกตามชนิดผ้า — ใช้ทั้งหน้าต่อตึกและหน้าสรุปรวมท้ายสุด (คอลัมน์เหมือนกันทุกอย่าง)
function CategoryBreakdownSection({ styles, heading, rows, totals, totalPct, totalLabel = 'รวมจำนวนทั้งหมด' }) {
  return (
    <View wrap={false}>
      <Text style={styles.h2}>{heading}</Text>
      <View style={styles.table}>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: COL.name }]}>รายการ</Text>
          <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>จำนวนสต็อค (Par)</Text>
          <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>จำนวนที่เติม</Text>
          <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>สต็อคบนวอร์ด</Text>
          <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>รวมทั้งหมด</Text>
        </View>
        {rows.map((r) => (
          <View style={styles.row} key={r.categoryId ?? r.categoryName}>
            <Text style={[styles.cell, { width: COL.name }]}>{r.categoryName}</Text>
            <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.parQty}</Text>
            <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.restockedQty}</Text>
            <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.onWardQty}</Text>
            <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.totalQty}</Text>
          </View>
        ))}
        <View style={styles.rowTotal}>
          <Text style={[styles.cellTotal, { width: COL.name }]}>{totalLabel}</Text>
          <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.parQty}</Text>
          <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.restockedQty}</Text>
          <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.onWardQty}</Text>
          <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.totalQty}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.cell, { width: '84%' }]}>คิดเป็นเปอร์เซ็นต์ (รวมทั้งหมด / จำนวนสต็อค)</Text>
          <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>
            {totalPct === null ? '—' : `${totalPct.toFixed(1)}%`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// หน้า "สรุปวอร์ด" — 1 แถว/วอร์ด (ยอดรวมทุกชนิดผ้า) กรุ๊ปเป็นตึกๆ ปิดท้ายด้วยยอดรวมทั้งหมด
// (เหมือนชีต "สรุปวอร์ด" ฝั่ง Excel — ดู restock-building-summary-utils.js#buildWardOverviewSections)
function WardOverviewTable({ styles, sections, grandTotal }) {
  return (
    <View style={styles.table}>
      <View style={styles.rowHead}>
        <Text style={[styles.cellHead, { width: WARD_COL.name }]}>วอร์ด</Text>
        <Text style={[styles.cellHead, { width: WARD_COL.num, textAlign: 'right' }]}>จำนวนที่เติมรวม</Text>
        <Text style={[styles.cellHead, { width: WARD_COL.num, textAlign: 'right' }]}>โอนข้ามตู้รวม</Text>
      </View>
      {sections.map((section) => (
        <View key={section.buildingName} wrap={false}>
          <View style={styles.rowSection}>
            <Text style={styles.cellSection}>ตึก{section.buildingName}</Text>
          </View>
          {section.wards.map((w) => (
            <View style={styles.row} key={w.wardName}>
              <Text style={[styles.cell, { width: WARD_COL.name }]}>{w.wardName}</Text>
              <Text style={[styles.cell, { width: WARD_COL.num, textAlign: 'right' }]}>{w.count}</Text>
              <Text style={[styles.cell, { width: WARD_COL.num, textAlign: 'right' }]}>{w.transferCount}</Text>
            </View>
          ))}
        </View>
      ))}
      <View style={styles.rowTotal}>
        <Text style={[styles.cellTotal, { width: WARD_COL.name }]}>ยอดรวมทุกวอร์ด</Text>
        <Text style={[styles.cellTotal, { width: WARD_COL.num, textAlign: 'right' }]}>{grandTotal.count}</Text>
        <Text style={[styles.cellTotal, { width: WARD_COL.num, textAlign: 'right' }]}>
          {grandTotal.transferCount}
        </Text>
      </View>
    </View>
  );
}

// รายละเอียดแยกตามชนิดผ้าของ 1 วอร์ด (เหมือน 1 ชีต/วอร์ด ฝั่ง Excel)
function WardDetailSection({ styles, ward }) {
  return (
    <View wrap={false}>
      <Text style={styles.h2}>
        {ward.wardName} (ตึก{ward.buildingName})
      </Text>
      <View style={styles.table}>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: WARD_COL.name }]}>หมวดหมู่ผ้า</Text>
          <Text style={[styles.cellHead, { width: WARD_COL.num, textAlign: 'right' }]}>จำนวนครั้งที่เติม</Text>
          <Text style={[styles.cellHead, { width: WARD_COL.num, textAlign: 'right' }]}>โอนข้ามตู้</Text>
        </View>
        {ward.rows.map((c) => (
          <View style={styles.row} key={c.categoryId ?? c.categoryName}>
            <Text style={[styles.cell, { width: WARD_COL.name }]}>{c.categoryName}</Text>
            <Text style={[styles.cell, { width: WARD_COL.num, textAlign: 'right' }]}>{c.count}</Text>
            <Text style={[styles.cell, { width: WARD_COL.num, textAlign: 'right' }]}>{c.transferCount}</Text>
          </View>
        ))}
        <View style={styles.rowTotal}>
          <Text style={[styles.cellTotal, { width: WARD_COL.name }]}>รวม</Text>
          <Text style={[styles.cellTotal, { width: WARD_COL.num, textAlign: 'right' }]}>{ward.total.count}</Text>
          <Text style={[styles.cellTotal, { width: WARD_COL.num, textAlign: 'right' }]}>
            {ward.total.transferCount}
          </Text>
        </View>
      </View>
    </View>
  );
}

const FOOTER_TEXT = 'รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น';

// โครงหน้าเดียวกับ export Excel ทุกประการ (ดู restock-building-summary-card.jsx):
// หน้า 1) ตึกที่เลือก (แยกตามชนิดผ้า) 2) "สรุปวอร์ด" ภาพรวมกรุ๊ปเป็นตึกๆ 3) รายละเอียดแต่ละวอร์ด
// 4) สรุปรวมทุกตึกที่เลือก แยกตามชนิดผ้า — แต่ละหัวข้อขึ้นหน้าใหม่เสมอ ถ้าเนื้อหายาวเกิน 1 หน้า
// react-pdf จะขึ้นหน้าเพิ่มให้เองอัตโนมัติ (wrap ที่ระดับ Page)
export function RestockBuildingReportPDF({
  hospitalName,
  range,
  scopeLabel,
  buildings,
  wardOverview,
  wardDetails,
  combinedSummary,
}) {
  const styles = useStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader styles={styles} title="รายงานการเติมสต๊อกประจำตึก" hospitalName={hospitalName} range={range} />
        {(buildings ?? []).map((b) => (
          <CategoryBreakdownSection
            key={b.buildingId ?? b.buildingName}
            styles={styles}
            heading={`ตึก${b.buildingName}`}
            rows={b.rows}
            totals={b.totals}
            totalPct={b.totalPct}
          />
        ))}
        <Text style={styles.footer}>{FOOTER_TEXT}</Text>
      </Page>

      {wardOverview && (
        <Page size="A4" style={styles.page} wrap>
          <ReportHeader styles={styles} title={`สรุปวอร์ด — ${scopeLabel}`} hospitalName={hospitalName} range={range} />
          <WardOverviewTable styles={styles} sections={wardOverview.sections} grandTotal={wardOverview.grandTotal} />
          <Text style={styles.footer}>{FOOTER_TEXT}</Text>
        </Page>
      )}

      {(wardDetails ?? []).length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <ReportHeader styles={styles} title="รายละเอียดการเติมผ้ารายวอร์ด" hospitalName={hospitalName} range={range} />
          {wardDetails.map((ward) => (
            <WardDetailSection key={`${ward.buildingName}-${ward.wardName}`} styles={styles} ward={ward} />
          ))}
          <Text style={styles.footer}>{FOOTER_TEXT}</Text>
        </Page>
      )}

      {combinedSummary && (
        <Page size="A4" style={styles.page} wrap>
          <ReportHeader
            styles={styles}
            title={`สรุปรวม${scopeLabel}`}
            hospitalName={hospitalName}
            range={range}
          />
          <CategoryBreakdownSection
            styles={styles}
            heading="แยกตามชนิดผ้า"
            rows={combinedSummary.rows}
            totals={combinedSummary.totals}
            totalPct={combinedSummary.totalPct}
            totalLabel="รวมผ้าทั้งหมด"
          />
          <Text style={styles.footer}>{FOOTER_TEXT}</Text>
        </Page>
      )}
    </Document>
  );
}
