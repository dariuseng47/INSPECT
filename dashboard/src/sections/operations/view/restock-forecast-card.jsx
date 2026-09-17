import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Avatar from '@mui/material/Avatar';
import { alpha } from '@mui/material/styles';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';

// ----------------------------------------------------------------------

const TREND_META = {
  เพิ่มขึ้น: { color: 'error', icon: 'solar:double-alt-arrow-up-bold-duotone' },
  ลดลง: { color: 'success', icon: 'solar:double-alt-arrow-down-bold-duotone' },
  คงที่: { color: 'default', icon: 'solar:arrow-right-bold-duotone' },
};

export function RestockForecastCard({ forecast, getCategoryColor }) {
  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:test-tube-bold-duotone" color="secondary" />}
        title="คาดการณ์การใช้ผ้า (Forecast)"
        subheader="ประมาณจากค่าเฉลี่ยการเติมผ้าต่อวันใน 30 วันล่าสุด — ใช้เป็นแนวทางคร่าวๆ ไม่ใช่ตัวเลขแม่นยำ"
      />
      {forecast.length === 0 ? (
        <EmptyContent title="ยังไม่มีข้อมูลพอสำหรับคาดการณ์" sx={{ py: 8 }} />
      ) : (
        <Scrollbar>
          <TableContainer sx={{ minWidth: 760 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>หมวดหมู่ผ้า</TableCell>
                  <TableCell align="right">รวม 30 วัน</TableCell>
                  <TableCell align="right">เฉลี่ย/วัน</TableCell>
                  <TableCell align="right">คาดการณ์ 7 วันข้างหน้า</TableCell>
                  <TableCell align="right">คาดการณ์ 30 วันข้างหน้า</TableCell>
                  <TableCell align="center">แนวโน้ม</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {forecast.map((f) => {
                  const color = getCategoryColor(f.categoryName);
                  return (
                    <TableRow key={f.categoryName} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ width: 30, height: 30, mr: 1.5, bgcolor: alpha(color, 0.16), color }}>
                            <Iconify icon="solar:t-shirt-bold-duotone" width={16} />
                          </Avatar>
                          <Typography variant="body2">{f.categoryName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{f.totalLast30Days}</TableCell>
                      <TableCell align="right">{f.avgPerDay}</TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{f.projectedNext7Days}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{f.projectedNext30Days}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          variant="soft"
                          color={TREND_META[f.trend]?.color ?? 'default'}
                          icon={<Iconify icon={TREND_META[f.trend]?.icon} width={14} />}
                          label={f.trend}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}
