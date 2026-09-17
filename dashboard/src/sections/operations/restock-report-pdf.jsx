import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

// ฟอนต์ Roboto เดิมของธีมไม่มีตัวอักษรไทย ใช้ Noto Sans Thai แทนสำหรับรายงานนี้โดยเฉพาะ
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

export function RestockReportPDF({ hospitalName, range, totals, wardGroups, rounds, forecast }) {
  const styles = useStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>รายงานการเติมผ้าประจำวอร์ด</Text>
            {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
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
            <Text style={styles.statValue}>{totals?.totalEvents ?? 0}</Text>
            <Text style={styles.statLabel}>ครั้งที่เติมผ้า</Text>
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

        <Text style={styles.h2}>สรุปการเติมผ้าแยกตามวอร์ด</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '30%' }]}>วอร์ด</Text>
            <Text style={[styles.cellHead, { width: '40%' }]}>หมวดหมู่ผ้า</Text>
            <Text style={[styles.cellHead, { width: '15%', textAlign: 'right' }]}>จำนวนครั้ง</Text>
            <Text style={[styles.cellHead, { width: '15%', textAlign: 'right' }]}>โอนข้ามตู้</Text>
          </View>
          {(wardGroups ?? []).flatMap((group) =>
            group.categories.map((c, idx) => (
              <View style={styles.row} key={`${group.wardName}-${c.categoryName}`}>
                <Text style={[styles.cell, { width: '30%' }]}>{idx === 0 ? group.wardName : ''}</Text>
                <Text style={[styles.cell, { width: '40%' }]}>{c.categoryName}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{c.count}</Text>
                <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>{c.transferCount}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.h2}>คาดการณ์การใช้ผ้า (Forecast)</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '30%' }]}>หมวดหมู่ผ้า</Text>
            <Text style={[styles.cellHead, { width: '17.5%', textAlign: 'right' }]}>รวม 30 วัน</Text>
            <Text style={[styles.cellHead, { width: '17.5%', textAlign: 'right' }]}>เฉลี่ย/วัน</Text>
            <Text style={[styles.cellHead, { width: '17.5%', textAlign: 'right' }]}>คาดการณ์ 7 วัน</Text>
            <Text style={[styles.cellHead, { width: '17.5%', textAlign: 'right' }]}>แนวโน้ม</Text>
          </View>
          {(forecast ?? []).map((f) => (
            <View style={styles.row} key={f.categoryName}>
              <Text style={[styles.cell, { width: '30%' }]}>{f.categoryName}</Text>
              <Text style={[styles.cell, { width: '17.5%', textAlign: 'right' }]}>{f.totalLast30Days}</Text>
              <Text style={[styles.cell, { width: '17.5%', textAlign: 'right' }]}>{f.avgPerDay}</Text>
              <Text style={[styles.cell, { width: '17.5%', textAlign: 'right' }]}>
                {f.projectedNext7Days}
              </Text>
              <Text style={[styles.cell, { width: '17.5%', textAlign: 'right' }]}>{f.trend}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>ประวัติการตรวจนับ/เติมผ้า (แยกเป็นรอบ)</Text>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: '22%' }]}>เวลา</Text>
            <Text style={[styles.cellHead, { width: '22%' }]}>วอร์ด</Text>
            <Text style={[styles.cellHead, { width: '22%' }]}>ตู้</Text>
            <Text style={[styles.cellHead, { width: '20%' }]}>ผู้ดำเนินการ</Text>
            <Text style={[styles.cellHead, { width: '14%', textAlign: 'right' }]}>จำนวน (ชิ้น)</Text>
          </View>
          {(rounds ?? []).slice(0, 40).map((r) => (
            <View style={styles.row} key={r.id}>
              <Text style={[styles.cell, { width: '22%' }]}>{fDateTime(r.createdAt)}</Text>
              <Text style={[styles.cell, { width: '22%' }]}>{r.wardName}</Text>
              <Text style={[styles.cell, { width: '22%' }]}>{r.cabinetName}</Text>
              <Text style={[styles.cell, { width: '20%' }]}>{r.userName}</Text>
              <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>{r.itemCount}</Text>
            </View>
          ))}
        </View>
        {(rounds ?? []).length > 40 && (
          <Text style={styles.muted}>...และอีก {rounds.length - 40} รอบ (ดูฉบับเต็มในหน้าเว็บ)</Text>
        )}

        <Text style={styles.footer}>
          รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น
        </Text>
      </Page>
    </Document>
  );
}
