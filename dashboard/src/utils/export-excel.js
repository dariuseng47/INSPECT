// ส่งออกตารางเป็นไฟล์ Excel โดยไม่พึ่งไลบรารีภายนอก — สร้างเป็น SpreadsheetML 2003 (.xls)
// ซึ่ง Microsoft Excel / Google Sheets / LibreOffice เปิดได้ตรงๆ และรองรับข้อความภาษาไทย (UTF-8)
// ครบถ้วน ต่างจากการ export CSV ที่ Excel มักตีความ encoding ผิดจนสระ/วรรณยุกต์เพี้ยน
//
// ใส่สไตล์ (หัวตารางพื้นเขียว, แถวรวมไฮไลท์, เส้นขอบ, ลายแถบสลับสี) ให้ตรงกับโทนสีของรายงาน
// PDF (#00A76F) — ดู restock-building-report-pdf.jsx ที่ใช้สีชุดเดียวกัน

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ตัดอักขระที่ห้ามใช้ในชื่อไฟล์ (Windows/macOS) ออก — ใช้แปะชื่อโรงพยาบาล/หน่วยงานเข้าไปในชื่อไฟล์
// export โดยไม่ต้องกังวลว่าชื่อจะมี "/" หรือเครื่องหมายอื่นที่ทำให้ path พัง
export function sanitizeFileName(name) {
  return String(name ?? '').replace(/[\\/:*?"<>|]/g, ' ').trim();
}

// Excel ห้ามใช้ : \ / ? * [ ] ในชื่อชีต และจำกัด 31 ตัวอักษร
function sanitizeSheetName(name, usedNames) {
  const base = String(name ?? 'Sheet1').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
  let candidate = base;
  let i = 2;
  while (usedNames.has(candidate)) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function cellXml(value, styleId) {
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell${styleAttr}><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell${styleAttr}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

const STYLES_XML = `<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Font ss:FontName="Tahoma" ss:Size="13"/>
  </Style>
  <Style ss:ID="sTitle">
   <Font ss:FontName="Tahoma" ss:Size="20" ss:Bold="1" ss:Color="#00A76F"/>
  </Style>
  <Style ss:ID="sSubtitle">
   <Font ss:FontName="Tahoma" ss:Size="13" ss:Color="#637381" ss:Italic="1"/>
  </Style>
  <Style ss:ID="sHeader">
   <Font ss:FontName="Tahoma" ss:Size="13" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#00A76F" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="sCell">
   <Font ss:FontName="Tahoma" ss:Size="13"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/>
   </Borders>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sCellAlt">
   <Font ss:FontName="Tahoma" ss:Size="13"/>
   <Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F0F0F0"/>
   </Borders>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sTotal">
   <Font ss:FontName="Tahoma" ss:Size="13" ss:Bold="1" ss:Color="#1B806A"/>
   <Interior ss:Color="#DFF3E8" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#00A76F"/>
   </Borders>
  </Style>
  <Style ss:ID="sSection">
   <Font ss:FontName="Tahoma" ss:Size="13" ss:Bold="1" ss:Color="#212B36"/>
   <Interior ss:Color="#EAEEF3" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

function columnsXml(columns) {
  return columns
    .map((col) => `<Column ss:Width="${col.width ?? Math.max(90, col.label.length * 12)}"/>`)
    .join('');
}

function titleRowsXml(title, subtitle, colSpan) {
  if (!title && !subtitle) return '';
  const mergeAttr = colSpan > 1 ? ` ss:MergeAcross="${colSpan - 1}"` : '';
  let xml = '';
  if (title) {
    xml += `<Row><Cell ss:StyleID="sTitle"${mergeAttr}><Data ss:Type="String">${escapeXml(title)}</Data></Cell></Row>`;
  }
  if (subtitle) {
    xml += `<Row><Cell ss:StyleID="sSubtitle"${mergeAttr}><Data ss:Type="String">${escapeXml(subtitle)}</Data></Cell></Row>`;
  }
  xml += '<Row></Row>';
  return xml;
}

function headerRowXml(columns) {
  return `<Row>${columns.map((c) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`).join('')}</Row>`;
}

// แถวหัวตารางกลุ่ม (merge ข้ามคอลัมน์ย่อยของกลุ่มนั้น) วางไว้เหนือแถว headerRowXml ปกติ — ใช้ตอนหัว
// ตารางเป็น 2 ชั้น เช่น ชื่อวอร์ด 1 กลุ่ม ครอบคอลัมน์ย่อย "แนะนำ/สแกน/เติม/หลังเติม" 4 คอลัมน์
// group ที่ไม่ระบุ span ถือว่า span = 1 (เช่นคอลัมน์ซ้ายสุดที่ไม่มีการ group เช่น "ชนิดผ้า")
function groupHeaderRowXml(groupHeader) {
  return `<Row>${groupHeader
    .map((g) => {
      const span = g.span ?? 1;
      const mergeAttr = span > 1 ? ` ss:MergeAcross="${span - 1}"` : '';
      return `<Cell ss:StyleID="sHeader"${mergeAttr}><Data ss:Type="String">${escapeXml(g.label)}</Data></Cell>`;
    })
    .join('')}</Row>`;
}

// แถวหัวข้อกลุ่มย่อยภายในชีต (เช่น คั่นเป็นตึกๆ ก่อนรายการวอร์ดของตึกนั้น) — เซลล์เดียว merge เต็มความกว้าง
function sectionRowXml(row, colSpan) {
  const mergeAttr = colSpan > 1 ? ` ss:MergeAcross="${colSpan - 1}"` : '';
  return `<Row><Cell ss:StyleID="sSection"${mergeAttr}><Data ss:Type="String">${escapeXml(row.sectionLabel)}</Data></Cell></Row>`;
}

function bodyRowsXml(columns, rows, totalRowIndexes, sectionRowIndexes) {
  const totalSet = new Set(totalRowIndexes);
  const sectionSet = new Set(sectionRowIndexes);
  return rows
    .map((row, i) => {
      if (sectionSet.has(i)) return sectionRowXml(row, columns.length);
      const styleId = totalSet.has(i) ? 'sTotal' : i % 2 === 1 ? 'sCellAlt' : 'sCell';
      return `<Row>${columns.map((col) => cellXml(row[col.key], styleId)).join('')}</Row>`;
    })
    .join('');
}

function worksheetXml(sheet, usedNames) {
  const { sheetName, title, subtitle, columns, rows, totalRowIndexes = [], sectionRowIndexes = [], groupHeader } = sheet;
  return `<Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheetName, usedNames))}">
  <Table>
   ${columnsXml(columns)}
   ${titleRowsXml(title, subtitle, columns.length)}
   ${groupHeader ? groupHeaderRowXml(groupHeader) : ''}
   ${headerRowXml(columns)}
   ${bodyRowsXml(columns, rows, totalRowIndexes, sectionRowIndexes)}
  </Table>
 </Worksheet>`;
}

function downloadXml(fileName, xml) {
  // นำหน้าด้วย BOM (U+FEFF) ให้ Excel รุ่นเก่าบางตัวอ่าน UTF-8 ได้ถูกต้อง
  const blob = new Blob(['\uFEFF', xml], { type: 'application/vnd.ms-excel;charset=UTF-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.toLowerCase().endsWith('.xls') ? fileName : `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ดาวน์โหลดข้อมูลหลายตารางเป็นไฟล์ Excel เดียว (คนละชีต)
 *
 * @param {object} opts
 * @param {string} opts.fileName
 * @param {object[]} opts.sheets
 * @param {string} opts.sheets[].sheetName
 * @param {string} [opts.sheets[].title]      หัวเรื่องรายงาน (แถวบนสุด, ตัวใหญ่สีเขียว)
 * @param {string} [opts.sheets[].subtitle]   บรรทัดรอง (เช่น ช่วงวันที่)
 * @param {{ key: string, label: string, width?: number }[]} opts.sheets[].columns
 * @param {object[]} opts.sheets[].rows             แถวปกติอ่านค่าตาม columns — แถวหัวข้อกลุ่มย่อยให้ใส่
 *   { sectionLabel: 'ชื่อกลุ่ม' } แทน แล้วระบุ index ไว้ใน sectionRowIndexes (เซลล์เดียว merge เต็มแถว)
 * @param {number[]} [opts.sheets[].totalRowIndexes]  index ของแถวใน rows ที่จะไฮไลท์เป็นแถวรวม
 * @param {number[]} [opts.sheets[].sectionRowIndexes] index ของแถวใน rows ที่เป็นหัวข้อกลุ่มย่อย (ดูด้านบน)
 * @param {{label: string, span?: number}[]} [opts.sheets[].groupHeader] แถวหัวตารางกลุ่มเพิ่มเติมเหนือ
 *   header ปกติ (merge ข้ามคอลัมน์ตาม span) ใช้เมื่อหัวตารางเป็น 2 ชั้น เช่น ชื่อวอร์ด 1 กลุ่ม ครอบ
 *   คอลัมน์ย่อยหลายคอลัมน์ — ผลรวม span ของทุก entry ควรเท่ากับ columns.length
 */
export function exportSheetsToExcel({ fileName, sheets }) {
  const usedNames = new Set();
  const worksheets = sheets.map((sheet) => worksheetXml(sheet, usedNames)).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 ${STYLES_XML}
${worksheets}
</Workbook>`;

  downloadXml(fileName, xml);
}

/**
 * ดาวน์โหลดข้อมูลตารางเดียวเป็นไฟล์ Excel (.xls) — ทางลัดของ exportSheetsToExcel สำหรับชีตเดียว
 *
 * @param {object} opts
 * @param {string} opts.fileName            ชื่อไฟล์ (ไม่ต้องใส่ .xls เติมให้เอง)
 * @param {string} [opts.sheetName='Sheet1'] ชื่อชีต
 * @param {string} [opts.title]             หัวเรื่องรายงาน (แถวบนสุด, ตัวใหญ่สีเขียว)
 * @param {string} [opts.subtitle]          บรรทัดรอง (เช่น ช่วงวันที่)
 * @param {{ key: string, label: string, width?: number }[]} opts.columns  หัวตาราง + คีย์ที่ใช้อ่านค่าจากแถว
 * @param {object[]} opts.rows             ข้อมูลแต่ละแถว
 * @param {number[]} [opts.totalRowIndexes] index ของแถวใน rows ที่จะไฮไลท์เป็นแถวรวม
 */
export function exportRowsToExcel({
  fileName,
  sheetName = 'Sheet1',
  title,
  subtitle,
  columns,
  rows,
  totalRowIndexes,
}) {
  exportSheetsToExcel({
    fileName,
    sheets: [{ sheetName, title, subtitle, columns, rows, totalRowIndexes }],
  });
}
