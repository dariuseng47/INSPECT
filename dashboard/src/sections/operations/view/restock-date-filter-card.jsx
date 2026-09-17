import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export const DATE_PRESETS = [
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

export function RestockDateFilterCard({
  startDate,
  endDate,
  activePreset,
  onChangeStartDate,
  onChangeEndDate,
  onSelectPreset,
  description = 'ใช้กับสรุปตามวอร์ดและประวัติด้านล่าง — กราฟแนวโน้ม 30 วันและคาดการณ์ไม่ผูกกับตัวกรองนี้',
  // 'date' = เลือกแค่วันที่ (ค่าเดิม), 'datetime' = เลือกถึงระดับชั่วโมง/นาทีด้วย (เช่น แท็บที่ต้องกรอง
  // ช่วงเวลาละเอียดกว่ารายวัน) — โครงสร้าง/สไตล์การ์ดเหมือนกันทุกอย่าง สลับแค่ตัว picker
  granularity = 'date',
}) {
  const PickerComponent = granularity === 'datetime' ? DateTimePicker : DatePicker;
  return (
    <Card sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SectionAvatar icon="solar:calendar-search-bold-duotone" color="primary" />
        <Box sx={{ ml: 1.5 }}>
          <Typography variant="subtitle1">เลือกช่วงเวลา</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {description}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {DATE_PRESETS.map((preset) => (
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

        <PickerComponent
          label="จากวันที่"
          value={startDate}
          onChange={onChangeStartDate}
          {...(granularity === 'datetime' ? { ampm: false } : {})}
          slotProps={{ textField: { size: 'small', sx: { width: granularity === 'datetime' ? 210 : 160 } } }}
        />
        <PickerComponent
          label="ถึงวันที่"
          value={endDate}
          onChange={onChangeEndDate}
          {...(granularity === 'datetime' ? { ampm: false } : {})}
          slotProps={{ textField: { size: 'small', sx: { width: granularity === 'datetime' ? 210 : 160 } } }}
        />
      </Box>
    </Card>
  );
}
