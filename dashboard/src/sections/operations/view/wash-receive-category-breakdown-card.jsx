import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';

import { fNumber, fPercent } from 'src/utils/format-number';

import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

export function WashReceiveCategoryBreakdownCard({ byCategory, getCategoryColor }) {
  const total = byCategory.reduce((sum, row) => sum + row.itemCount, 0) || 1;

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:chart-2-bold-duotone" color="info" />}
        title="สรุปยอดตามหมวดหมู่ผ้า"
        subheader="นับจำนวนชิ้นที่รับเข้าในช่วงเวลาที่เลือกด้านบน"
      />
      <Stack spacing={2} sx={{ p: 2.5, pt: 2.5 }}>
        {byCategory.length === 0 ? (
          <EmptyContent title="ไม่มีข้อมูลในช่วงเวลาที่เลือก" sx={{ py: 4 }} />
        ) : (
          byCategory.map((row) => {
            const color = getCategoryColor(row.categoryName);
            const percent = (row.itemCount / total) * 100;
            return (
              <Stack key={row.categoryId ?? row.categoryName} spacing={0.75}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      flexShrink: 0,
                      borderRadius: '50%',
                      bgcolor: color,
                    }}
                  />
                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                    {row.categoryName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {fPercent(percent)}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ minWidth: 64, textAlign: 'right' }}>
                    {fNumber(row.itemCount)} ชิ้น
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  sx={{
                    height: 6,
                    borderRadius: 1,
                    bgcolor: (theme) => theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
                  }}
                />
              </Stack>
            );
          })
        )}
      </Stack>
    </Card>
  );
}
