import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

import { cellKey } from './view/restock-fill-history-utils';

// ----------------------------------------------------------------------

Font.register({
  family: 'NotoSansThai',
  fonts: [
    { src: '/fonts/NotoSansThai-Regular.ttf' },
    { src: '/fonts/NotoSansThai-Bold.ttf', fontWeight: 700 },
  ],
});

const METRIC_LABELS = ['แนะนำ', 'สแกน', 'เติม', 'หลังเติม'];
const METRIC_FIELDS = ['recommendedQty', 'scannedQty', 'filledQty', 'afterFillQty'];
const NAME_COL_PCT = 14;

const useStyles = () =>
  useMemo(
    () =>
      StyleSheet.create({
        page: {
          fontSize: 8,
          lineHeight: 1.5,
          fontFamily: 'NotoSansThai',
          backgroundColor: '#FFFFFF',
          padding: '24px 24px',
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
          paddingBottom: 12,
          borderBottomWidth: 2,
          borderStyle: 'solid',
          borderColor: '#00A76F',
        },
        h1: { fontSize: 14, fontWeight: 700, color: '#00A76F' },
        muted: { fontSize: 7.5, color: '#637381' },
        table: { display: 'flex', width: '100%' },
        rowGroupHead: { flexDirection: 'row', backgroundColor: '#00A76F' },
        rowHead: { flexDirection: 'row', backgroundColor: '#F4F6F8' },
        row: {
          flexDirection: 'row',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowTotal: { flexDirection: 'row', backgroundColor: '#DFF3E8' },
        cellGroupHead: {
          fontSize: 7.5,
          fontWeight: 700,
          color: '#FFFFFF',
          textAlign: 'center',
          padding: '4px 2px',
          borderLeftWidth: 1,
          borderStyle: 'solid',
          borderColor: '#FFFFFF',
        },
        cellHead: {
          fontSize: 6.5,
          fontWeight: 700,
          color: '#454F5B',
          textAlign: 'right',
          padding: '3px 2px',
          borderLeftWidth: 1,
          borderStyle: 'solid',
          borderColor: '#E7EBEF',
        },
        cellName: { fontSize: 7.5, color: '#212B36', padding: '3px 2px' },
        cellNameHead: { fontSize: 7.5, fontWeight: 700, color: '#454F5B', padding: '3px 2px' },
        cell: {
          fontSize: 7.5,
          color: '#212B36',
          textAlign: 'right',
          padding: '3px 2px',
          borderLeftWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F5F5F5',
        },
        cellTotal: {
          fontSize: 7.5,
          fontWeight: 700,
          color: '#1B806A',
          textAlign: 'right',
          padding: '3px 2px',
          borderLeftWidth: 1,
          borderStyle: 'solid',
          borderColor: '#C8E6D8',
        },
        footer: {
          position: 'absolute',
          bottom: 14,
          left: 24,
          right: 24,
          textAlign: 'center',
          fontSize: 7,
          color: '#919EAB',
        },
      }),
    []
  );

function ReportHeader({ styles, title, hospitalName, scopeLabel }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.h1}>{title}</Text>
        {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
        {scopeLabel && <Text style={styles.muted}>ขอบเขต: {scopeLabel}</Text>}
      </View>
      <View>
        <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
      </View>
    </View>
  );
}

// ตาราง 1 วัน — จำลองหัวตาราง merge ด้วย View กว้างเท่าผลรวมคอลัมน์ย่อยของแต่ละวอร์ด (react-pdf ไม่มี
// colSpan จริง) แถวชนิดผ้าปล่อยให้ react-pdf ขึ้นหน้าใหม่เองอัตโนมัติถ้าเนื้อหาเกิน 1 หน้า
function DayTable({ styles, day, wards, categories }) {
  const wardColPct = wards.length > 0 ? (100 - NAME_COL_PCT) / wards.length : 100 - NAME_COL_PCT;
  const metricColPct = wardColPct / METRIC_LABELS.length;

  const totals = new Map();
  categories.forEach((cat) => {
    wards.forEach((w) => {
      const cell = day.cells[cellKey(cat.id, w.id)];
      if (!cell) return;
      METRIC_FIELDS.forEach((field) => {
        const key = `${w.id}_${field}`;
        totals.set(key, (totals.get(key) ?? 0) + cell[field]);
      });
    });
  });

  return (
    <View style={styles.table}>
      <View style={styles.rowGroupHead}>
        <Text style={[styles.cellGroupHead, { width: `${NAME_COL_PCT}%`, textAlign: 'left' }]}>ชนิดผ้า</Text>
        {wards.map((w) => (
          <Text key={w.id} style={[styles.cellGroupHead, { width: `${wardColPct}%` }]}>
            {w.name}
          </Text>
        ))}
      </View>
      <View style={styles.rowHead}>
        <Text style={[styles.cellNameHead, { width: `${NAME_COL_PCT}%` }]} />
        {wards.map((w) =>
          METRIC_LABELS.map((label) => (
            <Text key={`${w.id}-${label}`} style={[styles.cellHead, { width: `${metricColPct}%` }]}>
              {label}
            </Text>
          ))
        )}
      </View>
      {categories.map((cat) => (
        <View style={styles.row} key={cat.id}>
          <Text style={[styles.cellName, { width: `${NAME_COL_PCT}%` }]}>{cat.name}</Text>
          {wards.map((w) => {
            const cell = day.cells[cellKey(cat.id, w.id)];
            return METRIC_FIELDS.map((field) => (
              <Text key={`${w.id}-${field}`} style={[styles.cell, { width: `${metricColPct}%` }]}>
                {cell ? cell[field] : '—'}
              </Text>
            ));
          })}
        </View>
      ))}
      <View style={styles.rowTotal}>
        <Text style={[styles.cellTotal, { width: `${NAME_COL_PCT}%`, textAlign: 'left' }]}>รวมทุกชนิดผ้า</Text>
        {wards.map((w) =>
          METRIC_FIELDS.map((field) => (
            <Text key={`${w.id}-${field}-total`} style={[styles.cellTotal, { width: `${metricColPct}%` }]}>
              {totals.has(`${w.id}_${field}`) ? totals.get(`${w.id}_${field}`) : '—'}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const FOOTER_TEXT = 'รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น';

// 1 Page (แนวนอน) ต่อ 1 วัน — เนื้อหายาวเกิน 1 หน้า react-pdf จะขึ้นหน้าเพิ่มให้เองอัตโนมัติ
export function RestockFillHistoryPDF({ hospitalName, scopeLabel, days, wards, categories }) {
  const styles = useStyles();

  return (
    <Document>
      {(days ?? []).map((day) => (
        <Page key={day.date} size="A4" orientation="landscape" style={styles.page} wrap>
          <ReportHeader
            styles={styles}
            title={`ประวัติการเติมผ้า — ${fDate(day.date)}`}
            hospitalName={hospitalName}
            scopeLabel={scopeLabel}
          />
          <DayTable styles={styles} day={day} wards={wards} categories={categories} />
          <Text style={styles.footer}>{FOOTER_TEXT}</Text>
        </Page>
      ))}
    </Document>
  );
}
