import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

// ฟอนต์ Roboto เดิมของธีมไม่มีตัวอักษรไทย ใช้ Noto Sans Thai แทนสำหรับรายงานนี้โดยเฉพาะ
// (ตัวเดียวกับ restock-report-pdf.jsx — Font.register ซ้ำ family เดิมไม่มีปัญหา ฝั่ง react-pdf
// dedupe ให้เองตาม family name)
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
        h1: { fontSize: 18, fontWeight: 700, color: '#00A76F' },
        h2: { fontSize: 12, fontWeight: 700, marginBottom: 8, marginTop: 18 },
        muted: { fontSize: 8, color: '#637381' },
        statRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
        statBox: {
          flexGrow: 1,
          padding: 10,
          borderRadius: 6,
          backgroundColor: '#F4F6F8',
        },
        statValue: { fontSize: 16, fontWeight: 700 },
        statLabel: { fontSize: 8, color: '#637381', marginTop: 2 },
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
        cellHead: { fontSize: 8, fontWeight: 700, color: '#454F5B' },
        cell: { fontSize: 8, color: '#212B36' },
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

const ROW_LIMIT = 40;

export function WashReceiveReportPDF({ range, totals, byCategory, batches }) {
  const styles = useStyles();

  const maxCategoryCount = Math.max(...(byCategory ?? []).map((c) => c.itemCount), 1);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>รายงานรับผ้าหลังซัก & ชั่งน้ำหนักผ้า</Text>
            <Text style={styles.muted}>
              ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : '-'}
            </Text>
          </View>
          <View>
            <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totals?.totalBatches ?? 0}</Text>
            <Text style={styles.statLabel}>ชุดสแกน+ชั่ง</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totals?.totalItems ?? 0}</Text>
            <Text style={styles.statLabel}>ผ้าที่รับเข้า (ชิ้น)</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {(totals?.totalWeightKg ?? 0).toLocaleString('th-TH')}
            </Text>
            <Text style={styles.statLabel}>น้ำหนักรวม (กก.)</Text>
          </View>
        </View>

        <Text style={styles.h2}>สรุปยอดตามหมวดหมู่ผ้า</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '50%' }]}>หมวดหมู่ผ้า</Text>
            <Text style={[styles.cellHead, { width: '25%', textAlign: 'right' }]}>จำนวน (ชิ้น)</Text>
            <Text style={[styles.cellHead, { width: '25%', textAlign: 'right' }]}>สัดส่วน</Text>
          </View>
          {(byCategory ?? []).map((row) => (
            <View style={styles.row} key={row.categoryId ?? row.categoryName}>
              <Text style={[styles.cell, { width: '50%' }]}>{row.categoryName}</Text>
              <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{row.itemCount}</Text>
              <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>
                {Math.round((row.itemCount / maxCategoryCount) * 100)}%
              </Text>
            </View>
          ))}
          {(byCategory ?? []).length === 0 && (
            <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</Text>
          )}
        </View>

        <Text style={styles.h2}>ประวัติชุดสแกน + ชั่งน้ำหนัก</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '30%' }]}>เวลา</Text>
            <Text style={[styles.cellHead, { width: '25%', textAlign: 'right' }]}>จำนวน (ชิ้น)</Text>
            <Text style={[styles.cellHead, { width: '20%', textAlign: 'right' }]}>น้ำหนัก (กก.)</Text>
            <Text style={[styles.cellHead, { width: '25%' }]}>บันทึกโดย</Text>
          </View>
          {(batches ?? []).slice(0, ROW_LIMIT).map((b) => (
            <View style={styles.row} key={b.id}>
              <Text style={[styles.cell, { width: '30%' }]}>{fDateTime(b.createdAt)}</Text>
              <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{b.itemCount}</Text>
              <Text style={[styles.cell, { width: '20%', textAlign: 'right' }]}>
                {b.weightKg.toLocaleString('th-TH')}
              </Text>
              <Text style={[styles.cell, { width: '25%' }]}>{b.userName}</Text>
            </View>
          ))}
          {(batches ?? []).length === 0 && (
            <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</Text>
          )}
        </View>
        {(batches ?? []).length > ROW_LIMIT && (
          <Text style={styles.muted}>
            ...และอีก {batches.length - ROW_LIMIT} ชุด (ดูฉบับเต็มในหน้าเว็บ)
          </Text>
        )}

        <Text style={styles.footer}>
          รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น
        </Text>
      </Page>
    </Document>
  );
}
