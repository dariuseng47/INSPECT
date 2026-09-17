import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export const WASH_RECEIVE_DATE_PRESETS = [
  { label: 'วันนี้', getRange: () => [dayjs(), dayjs()] },
  { label: 'เดือนนี้', getRange: () => [dayjs().startOf('month'), dayjs()] },
  {
    label: 'เดือนที่แล้ว',
    getRange: () => [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
  { label: 'ปีนี้', getRange: () => [dayjs().startOf('year'), dayjs()] },
  {
    label: 'ปีที่แล้ว',
    getRange: () => [
      dayjs().subtract(1, 'year').startOf('year'),
      dayjs().subtract(1, 'year').endOf('year'),
    ],
  },
];

export function WashReceiveDateFilterCard({
  startDate,
  endDate,
  activePreset,
  onChangeStartDate,
  onChangeEndDate,
  onSelectPreset,
  action,
}) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Box
        sx={{
          mb: 2,
          gap: 1.5,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SectionAvatar icon="solar:calendar-search-bold-duotone" color="primary" />
          <Typography variant="subtitle1" sx={{ ml: 1.5 }}>
            เลือกช่วงเวลารายงาน
          </Typography>
        </Box>

        {action}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {WASH_RECEIVE_DATE_PRESETS.map((preset) => (
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
          label="จากวันที่"
          value={startDate}
          onChange={onChangeStartDate}
          slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
        />
        <DatePicker
          label="ถึงวันที่"
          value={endDate}
          onChange={onChangeEndDate}
          slotProps={{ textField: { size: 'small', sx: { width: 160 } } }}
        />
      </Box>
    </Card>
  );
}
