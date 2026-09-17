import dayjs from 'dayjs';

// ----------------------------------------------------------------------

// กรอง rows ตามช่วงวันที่ (inclusive ทั้งสองฝั่ง) จากฟิลด์วันที่ที่ระบุ — คืน rows เดิมทั้งหมดถ้า
// เลือกพรีเซ็ต "ทั้งหมด" (startDate/endDate เป็น null ทั้งคู่ ดู FABRIC_DATE_PRESETS)
export function filterRowsByDateRange(rows, field, startDate, endDate) {
  if (!startDate && !endDate) return rows;
  const from = startDate ? dayjs(startDate).startOf('day') : null;
  const to = endDate ? dayjs(endDate).endOf('day') : null;
  return rows.filter((row) => {
    const value = row[field];
    if (!value || value === '0000-00-00') return false;
    const d = dayjs(value);
    if (from && d.isBefore(from)) return false;
    if (to && d.isAfter(to)) return false;
    return true;
  });
}

// ช่วงเวลาให้ทั้งหัว Excel (string) และ PDF (ต้องการ { from, to } ที่ fDate ใช้ได้ตรงๆ — ดู
// restock-building-report-pdf.jsx#ReportHeader) ใช้ร่วมกัน
export function fabricRangeLabel(startDate, endDate) {
  if (!startDate && !endDate) return 'ทั้งหมด';
  if (startDate && endDate) return `${dayjs(startDate).format('DD/MM/YYYY')} — ${dayjs(endDate).format('DD/MM/YYYY')}`;
  if (startDate) return `ตั้งแต่ ${dayjs(startDate).format('DD/MM/YYYY')}`;
  return `ถึง ${dayjs(endDate).format('DD/MM/YYYY')}`;
}

export function fabricPdfRange(startDate, endDate) {
  if (!startDate && !endDate) return null;
  return { from: startDate ?? endDate, to: endDate ?? startDate };
}
