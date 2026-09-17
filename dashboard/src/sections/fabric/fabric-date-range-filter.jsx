import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// ----------------------------------------------------------------------

// ตัวกรองช่วงวันที่แบบกะทัดรัด ใช้ร่วมกันทุกเมนูย่อยของ "จัดการผ้าและล็อต" — default เป็น "ทั้งหมด"
// (ไม่กรอง) ต่างจากรายงานฝั่ง operations ที่ default เป็น 7/30 วันล่าสุด เพราะหน้าพวกนี้เป็นหน้า
// คลัง/ทะเบียนที่ผู้ใช้มักอยากเห็นภาพรวมทั้งหมดก่อน แล้วค่อยกรองวันที่เพิ่มทีหลังตอนจะ export
export const FABRIC_DATE_PRESETS = [
  { label: 'ทั้งหมด', getRange: () => [null, null] },
  { label: '7 วันล่าสุด', getRange: () => [dayjs().subtract(6, 'day'), dayjs()] },
  { label: '30 วันล่าสุด', getRange: () => [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'เดือนนี้', getRange: () => [dayjs().startOf('month'), dayjs()] },
  {
    label: 'เดือนที่แล้ว',
    getRange: () => [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
];

export function FabricDateRangeFilter({
  startDate,
  endDate,
  activePreset,
  onChangeStartDate,
  onChangeEndDate,
  onSelectPreset,
  dateLabel = 'วันที่',
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      {FABRIC_DATE_PRESETS.map((preset) => (
        <Chip
          key={preset.label}
          label={preset.label}
          size="small"
          variant={activePreset === preset.label ? 'filled' : 'soft'}
          color={activePreset === preset.label ? 'primary' : 'default'}
          onClick={() => onSelectPreset(preset)}
          sx={{ cursor: 'pointer' }}
        />
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

      <DatePicker
        label={`${dateLabel}จาก`}
        value={startDate}
        onChange={onChangeStartDate}
        slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
      />
      <DatePicker
        label={`${dateLabel}ถึง`}
        value={endDate}
        onChange={onChangeEndDate}
        slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
      />
    </Box>
  );
}
