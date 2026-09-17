import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

// ฟอนต์ Roboto เดิมของธีมไม่มีตัวอักษรไทย ใช้ Noto Sans Thai แทน (ตัวเดียวกับรายงานฝั่ง
// operations — react-pdf dedupe family name ให้เอง จึง register ซ้ำได้ไม่มีปัญหา)
Font.register({
  family: 'NotoSansThai',
  fonts: [
    { src: '/fonts/NotoSansThai-Regular.ttf' },
    { src: '/fonts/NotoSansThai-Bold.ttf', fontWeight: 700 },
  ],
});

// react-pdf ตัดขึ้นบรรทัดใหม่ที่ "คำ" (คั่นด้วยช่องว่าง) เท่านั้น — ไม่มี CSS wordBreak ให้ใช้แบบเว็บ
// รหัส EPC เป็นสตริงยาวติดกันไม่มีช่องว่าง จึงทะลุขอบคอลัมน์แทนที่จะขึ้นบรรทัดใหม่ วิธีที่ถูกต้องคือ
// ลงทะเบียน hyphenationCallback ให้ตัดได้ทีละตัวอักษรเมื่อคำทั้งคำยาวเกินความกว้างที่มี (มีผลเฉพาะ
// คำที่ยาวเกินจนวางไม่พอดีเท่านั้น คำ/ประโยคปกติยังขึ้นบรรทัดใหม่ที่ช่องว่างตามปกติ)
// ดู https://react-pdf.org/fonts#registerhyphenationcallback
Font.registerHyphenationCallback((word) => word.split(''));

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
        rowHead: { flexDirection: 'row', backgroundColor: '#F4F6F8', padding: '6px 4px' },
        row: {
          flexDirection: 'row',
          padding: '6px 4px',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowAlt: {
          flexDirection: 'row',
          padding: '6px 4px',
          backgroundColor: '#FBFCFD',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowTotal: {
          flexDirection: 'row',
          padding: '6px 4px',
          backgroundColor: '#DFF3E8',
        },
        cellHead: { fontSize: 8, fontWeight: 700, color: '#454F5B' },
        cell: { fontSize: 8, color: '#212B36' },
        cellTotal: { fontSize: 8, fontWeight: 700, color: '#1B806A' },
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

const ROW_LIMIT = 400;
const FOOTER_TEXT = 'รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น';

// คอลัมน์ใช้ width เป็นตัวเลข (หน่วยเดียวกับที่ export-excel.js ใช้ทำ ss:Width ของ Excel) เพื่อให้
// นิยามคอลัมน์ชุดเดียวใช้ได้ทั้ง Excel และ PDF — ที่นี่แปลงเป็นสัดส่วน % ของผลรวมความกว้างทั้งหมด
// (ห้ามส่ง width เป็นสตริง '18%' ตรงๆ เพราะจะไปเข้า export-excel.js เป็นค่า ss:Width ที่ไม่ถูกต้อง
// ทำให้ Excel/Numbers อ่านไฟล์ไม่ได้)
function columnsWithPdfWidth(columns) {
  const total = columns.reduce((sum, col) => sum + (col.width ?? 100), 0) || 1;
  return columns.map((col) => ({ ...col, pdfWidth: `${((col.width ?? 100) / total) * 100}%` }));
}

function ReportHeader({ styles, title, hospitalName, subtitle, range }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.h1}>{title}</Text>
        {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
        <Text style={styles.muted}>
          ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : 'ทั้งหมด'}
        </Text>
        {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      </View>
      <View>
        <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
      </View>
    </View>
  );
}

// ตารางสรุปยอด 2 คอลัมน์ (รายการ/จำนวน) ใช้กับหน้าสรุปยอดรวมท้ายรายงาน — ดู summarySections
function SummarySection({ styles, heading, rows, totalLabel, totalCount }) {
  return (
    <View wrap={false} style={{ marginBottom: 4 }}>
      <Text style={styles.h2}>{heading}</Text>
      <View style={styles.table}>
        <View style={styles.rowHead}>
          <Text style={[styles.cellHead, { width: '70%' }]}>รายการ</Text>
          <Text style={[styles.cellHead, { width: '30%', textAlign: 'right' }]}>จำนวน (ชิ้น)</Text>
        </View>
        {rows.map((row) => (
          <View style={styles.row} key={row.label}>
            <Text style={[styles.cell, { width: '70%' }]}>{row.label}</Text>
            <Text style={[styles.cell, { width: '30%', textAlign: 'right' }]}>{row.count}</Text>
          </View>
        ))}
        {rows.length === 0 && (
          <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูล</Text>
        )}
        <View style={styles.rowTotal}>
          <Text style={[styles.cellTotal, { width: '70%' }]}>{totalLabel}</Text>
          <Text style={[styles.cellTotal, { width: '30%', textAlign: 'right' }]}>{totalCount}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * รายงาน PDF ตารางเดียวแบบทั่วไป ใช้กับทุกเมนูย่อยของ "จัดการผ้าและล็อต" (คลังผ้า/ล็อต/พัก-ชำรุด/
 * จำหน่ายออก) — โครงหน้าเดียวกับรายงาน Excel ที่ export ด้วย exportRowsToExcel (ดู export-excel.js)
 * เพื่อไม่ให้ตัวเลขสองฝั่งเพี้ยนกัน
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.hospitalName]
 * @param {string} [opts.subtitle]           บรรทัดเสริมใต้ชื่อโรงพยาบาล เช่น ตัวกรองที่ใช้อยู่
 * @param {{ from: any, to: any }|null} [opts.range]  ช่วงวันที่ที่กรอง (null = ไม่ได้กรอง/ทั้งหมด)
 * @param {{ key: string, label: string, width?: number, align?: 'left'|'right'|'center' }[]} opts.columns
 * @param {object[]} opts.rows
 * @param {{ heading: string, rows: { label: string, count: number }[], totalLabel: string, totalCount: number }[]} [opts.summarySections]
 *   ถ้าระบุ จะเพิ่มหน้าสุดท้ายเป็นหน้าสรุปยอดรวม (แยกตามมิติต่างๆ) ต่อท้ายตารางหลัก
 */
export function FabricListReportPDF({ title, hospitalName, subtitle, range, columns, rows, summarySections }) {
  const styles = useStyles();
  const pdfColumns = columnsWithPdfWidth(columns);
  const limitedRows = rows.slice(0, ROW_LIMIT);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader styles={styles} title={title} hospitalName={hospitalName} subtitle={subtitle} range={range} />

        <View style={styles.table}>
          <View style={styles.rowHead}>
            {pdfColumns.map((col) => (
              <Text
                key={col.key}
                style={[styles.cellHead, { width: col.pdfWidth, textAlign: col.align ?? 'left' }]}
              >
                {col.label}
              </Text>
            ))}
          </View>
          {limitedRows.map((row, i) => (
            <View style={i % 2 === 1 ? styles.rowAlt : styles.row} key={row.__key ?? i}>
              {pdfColumns.map((col) => (
                <Text
                  key={col.key}
                  style={[styles.cell, { width: col.pdfWidth, textAlign: col.align ?? 'left' }]}
                >
                  {row[col.key] ?? '—'}
                </Text>
              ))}
            </View>
          ))}
          {limitedRows.length === 0 && (
            <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลตามเงื่อนไขที่เลือก</Text>
          )}
        </View>
        {rows.length > ROW_LIMIT && (
          <Text style={styles.muted}>
            ...และอีก {rows.length - ROW_LIMIT} รายการ (ดูฉบับเต็มในไฟล์ Excel)
          </Text>
        )}

        <Text style={styles.footer}>
          รวมทั้งหมด {rows.length} รายการ · {FOOTER_TEXT}
        </Text>
      </Page>

      {summarySections && summarySections.length > 0 && (
        <Page size="A4" style={styles.page} wrap>
          <ReportHeader
            styles={styles}
            title={`สรุปยอดรวม — ${title}`}
            hospitalName={hospitalName}
            subtitle={subtitle}
            range={range}
          />
          {summarySections.map((section) => (
            <SummarySection
              key={section.heading}
              styles={styles}
              heading={section.heading}
              rows={section.rows}
              totalLabel={section.totalLabel}
              totalCount={section.totalCount}
            />
          ))}
          <Text style={styles.footer}>{FOOTER_TEXT}</Text>
        </Page>
      )}
    </Document>
  );
}
