import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';

import { Iconify } from 'src/components/iconify';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

function HighlightRow({ icon, color, label, value, caption }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
      <Avatar sx={{ width: 40, height: 40, mr: 1.75, flexShrink: 0, bgcolor: `${color}.lighter`, color: `${color}.darker` }}>
        <Iconify icon={icon} width={20} />
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="subtitle1" noWrap>
          {value}
        </Typography>
        {caption && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {caption}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// การ์ดสรุปไฮไลท์ของช่วงเวลาที่เลือก — วางคู่กับกราฟแนวโน้มเพื่อให้เห็นภาพรวมที่น่าสนใจที่สุด
// ได้ทันทีโดยไม่ต้องไล่อ่านตาราง/กราฟทั้งหมด
export function RestockHighlightsCard({ peakDayLabel, topWard, topCategory }) {
  return (
    <Card sx={{ height: 1 }}>
      <CardHeader
        avatar={<SectionAvatar icon="solar:bolt-bold-duotone" color="warning" />}
        title="ไฮไลท์ช่วงเวลานี้"
      />
      <Box sx={{ px: 2.5, pb: 2 }}>
        <HighlightRow
          icon="solar:fire-bold-duotone"
          color="error"
          label="วันที่ใช้ผ้ามากที่สุด"
          value={peakDayLabel ?? 'ไม่มีข้อมูล'}
        />
        <Divider sx={{ borderStyle: 'dashed' }} />
        <HighlightRow
          icon="solar:hospital-bold-duotone"
          color="success"
          label="วอร์ดที่เติมผ้ามากที่สุด"
          value={topWard ? topWard.wardName : 'ไม่มีข้อมูล'}
          caption={topWard ? `${topWard.total} ชิ้น` : undefined}
        />
        <Divider sx={{ borderStyle: 'dashed' }} />
        <HighlightRow
          icon="solar:t-shirt-bold-duotone"
          color="primary"
          label="หมวดหมู่ผ้ายอดฮิต"
          value={topCategory ? topCategory.name : 'ไม่มีข้อมูล'}
          caption={topCategory ? `${topCategory.total} ชิ้น ใน 30 วันล่าสุด` : undefined}
        />
      </Box>
    </Card>
  );
}
