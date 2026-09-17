import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

// ฟอนต์ Roboto เดิมของธีมไม่มีตัวอักษรไทย ใช้ Noto Sans Thai แทนสำหรับรายงานนี้โดยเฉพาะ
// (ตัวเดียวกับ wash-receive-report-pdf.jsx / restock-report-pdf.jsx — react-pdf dedupe
// family name ให้เอง จึง register ซ้ำได้ไม่มีปัญหา)
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
        statBox: { flexGrow: 1, padding: 10, borderRadius: 6, backgroundColor: '#F4F6F8' },
        statValue: { fontSize: 16, fontWeight: 700 },
        statLabel: { fontSize: 8, color: '#637381', marginTop: 2 },
        table: { display: 'flex', width: '100%', marginBottom: 4 },
        rowHead: { flexDirection: 'row', backgroundColor: '#F4F6F8', padding: '6px 4px' },
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

const ROW_LIMIT = 45;

function SummaryTable({ styles, title, labelHead, rows }) {
  return (
    <>
      <Text style={styles.h2}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: '50%' }]}>{labelHead}</Text>
          <Text style={[styles.cellHead, { width: '25%', textAlign: 'right' }]}>จำนวน (ชิ้น)</Text>
          <Text style={[styles.cellHead, { width: '25%', textAlign: 'right' }]}>โอนข้ามตู้</Text>
        </View>
        {rows.map((row) => (
          <View style={styles.row} key={row.label}>
            <Text style={[styles.cell, { width: '50%' }]}>{row.label}</Text>
            <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{row.count}</Text>
            <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{row.transferCount}</Text>
          </View>
        ))}
        {rows.length === 0 && (
          <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</Text>
        )}
      </View>
    </>
  );
}

export function WardIssueHistoryReportPDF({
  range,
  totals,
  granularityLabel,
  byBucket,
  byCategory,
  byWard,
  history,
}) {
  const styles = useStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>รายงานประวัติการจ่ายผ้าประจำวอร์ด</Text>
            <Text style={styles.muted}>
              ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : '-'} · มุมมอง{' '}
              {granularityLabel}
            </Text>
          </View>
          <View>
            <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totals?.totalEvents ?? 0}</Text>
            <Text style={styles.statLabel}>ครั้งที่จ่ายผ้า (ชิ้น)</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totals?.totalTransfers ?? 0}</Text>
            <Text style={styles.statLabel}>โอนผ้าข้ามตู้</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totals?.totalRounds ?? 0}</Text>
            <Text style={styles.statLabel}>รอบตรวจนับ/เติมผ้า</Text>
          </View>
        </View>

        <SummaryTable
          styles={styles}
          title={`สรุปยอด${granularityLabel}`}
          labelHead="ช่วงเวลา"
          rows={byBucket ?? []}
        />

        <SummaryTable
          styles={styles}
          title="สรุปตามหมวดหมู่ผ้า"
          labelHead="หมวดหมู่ผ้า"
          rows={byCategory ?? []}
        />

        <SummaryTable styles={styles} title="สรุปตามวอร์ด" labelHead="วอร์ด" rows={byWard ?? []} />

        <Text style={styles.h2}>ประวัติรายชิ้น</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '22%' }]}>เวลา</Text>
            <Text style={[styles.cellHead, { width: '20%' }]}>รหัส EPC</Text>
            <Text style={[styles.cellHead, { width: '18%' }]}>หมวดหมู่</Text>
            <Text style={[styles.cellHead, { width: '15%' }]}>วอร์ด</Text>
            <Text style={[styles.cellHead, { width: '15%' }]}>ผู้ดำเนินการ</Text>
            <Text style={[styles.cellHead, { width: '10%', textAlign: 'right' }]}>ประเภท</Text>
          </View>
          {(history ?? []).slice(0, ROW_LIMIT).map((h) => (
            <View style={styles.row} key={h.id}>
              <Text style={[styles.cell, { width: '22%' }]}>{fDateTime(h.scannedAt)}</Text>
              <Text style={[styles.cell, { width: '20%' }]}>{h.epcCode}</Text>
              <Text style={[styles.cell, { width: '18%' }]}>{h.categoryName}</Text>
              <Text style={[styles.cell, { width: '15%' }]}>{h.wardName}</Text>
              <Text style={[styles.cell, { width: '15%' }]}>{h.userName}</Text>
              <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>
                {h.isTransfer ? 'โอนข้ามตู้' : 'เติมใหม่'}
              </Text>
            </View>
          ))}
          {(history ?? []).length === 0 && (
            <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</Text>
          )}
        </View>
        {(history ?? []).length > ROW_LIMIT && (
          <Text style={styles.muted}>
            ...และอีก {history.length - ROW_LIMIT} รายการ (ดูฉบับเต็มในไฟล์ Excel หรือหน้าเว็บ)
          </Text>
        )}

        <Text style={styles.footer}>
          รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น
        </Text>
      </Page>
    </Document>
  );
}
