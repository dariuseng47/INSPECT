import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Accordion from '@mui/material/Accordion';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { fDateTime } from 'src/utils/format-time';

import { useGetRestockCartPlan } from 'src/actions/restockCartPlan';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

export function WardCartPlanView({ hospitalId }) {
  const {
    generatedAt,
    cabinets,
    summary,
    totals,
    cartPlanLoading,
    refreshCartPlan,
  } = useGetRestockCartPlan(hospitalId);

  // ผ้าถูกจ่าย/รับคืน/ตรวจนับตู้/เปลี่ยนสถานะ จากที่ไหนก็ตาม -> คำนวณแผนใหม่ทันที
  useSocketEvent('scan:ward-issue', refreshCartPlan);
  useSocketEvent('scan:ward-receive', refreshCartPlan);
  useSocketEvent('scan:cabinet-audit', refreshCartPlan);
  useSocketEvent('scan:wash-receive', refreshCartPlan);
  useSocketEvent('scan:status-change', refreshCartPlan);

  if (cartPlanLoading) return <LoadingScreen />;

  const cabinetsToRestock = cabinets.filter((c) => c.totalSuggestedLoad > 0);
  const cabinetsNoPar = cabinets.filter((c) => !c.hasParConfig);
  const cabinetsStocked = cabinets.filter((c) => c.hasParConfig && c.totalSuggestedLoad === 0);

  return (
    <Stack spacing={3}>
      <Alert severity="info" icon={<Iconify icon="solar:cart-large-4-bold-duotone" />}>
        พนักงานเติมผ้าเปิดหน้านี้ก่อนออกรอบ เพื่อดูว่าต้องจัดผ้าแต่ละชนิดขึ้นรถกี่ชิ้น — ระบบประเมิน
        &ldquo;ผ้าที่น่าจะยังอยู่ในตู้&rdquo; จากผ้าที่เคยสแกนเช็คตู้/สแกนเติมเข้าตู้ แล้วหักผ้าที่ถูกใช้
        ไปแล้ว (สแกนรับคืน / เข้าโรงซัก / เข้าสต๊อค) จากนั้นเทียบกับ par level ของตู้
      </Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <StatCard
            icon="solar:t-shirt-bold-duotone"
            title="ผ้าที่ต้องจัดขึ้นรถรวม (ชิ้น)"
            value={totals.totalSuggestedLoad}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            icon="solar:box-bold-duotone"
            title="ตู้ที่ต้องเติม"
            value={`${totals.cabinetsNeedingRestock}/${totals.cabinetCount}`}
            color="warning"
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            icon="solar:hanger-2-bold-duotone"
            title="ชนิดผ้าที่ต้องจัด"
            value={totals.categoryCount}
            color="info"
          />
        </Grid>
      </Grid>

      <Card>
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: 'primary.lighter', color: 'primary.darker' }}>
              <Iconify icon="solar:cart-large-4-bold-duotone" width={22} />
            </Avatar>
          }
          title="สรุปรวม — ผ้าที่ต้องจัดเข้ารถ"
          subheader={
            generatedAt
              ? `คำนวณเมื่อ ${fDateTime(generatedAt)} — รวมทุกตู้ในโรงพยาบาล`
              : 'รวมทุกตู้ในโรงพยาบาล'
          }
          action={
            <Button
              size="small"
              color="inherit"
              startIcon={<Iconify icon="solar:refresh-bold-duotone" />}
              onClick={() => refreshCartPlan()}
            >
              คำนวณใหม่
            </Button>
          }
        />
        {summary.length === 0 ? (
          <EmptyContent
            title="ทุกตู้ผ้ามีผ้าครบ par level แล้ว"
            description="ยังไม่ต้องจัดผ้าขึ้นรถในรอบนี้"
            sx={{ py: 8 }}
          />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 640 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>หมวดหมู่ผ้า</TableCell>
                    <TableCell align="center">จำนวนตู้ที่ต้องเติม</TableCell>
                    <TableCell align="right">จัดขึ้นรถ (ชิ้น)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.map((row) => (
                    <TableRow key={row.fabricCategoryId} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar
                            sx={{
                              width: 30,
                              height: 30,
                              mr: 1.5,
                              bgcolor: 'primary.lighter',
                              color: 'primary.darker',
                            }}
                          >
                            <Iconify icon="solar:t-shirt-bold-duotone" width={16} />
                          </Avatar>
                          <Typography variant="body2">{row.categoryName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">{row.cabinetCount}</TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle1" sx={{ color: 'primary.main' }}>
                          {row.totalSuggestedLoad}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </Card>

      <Card>
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: 'warning.lighter', color: 'warning.darker' }}>
              <Iconify icon="solar:box-bold-duotone" width={22} />
            </Avatar>
          }
          title="แยกรายตู้"
          subheader="เปิดดูว่าตู้ไหนต้องเติมผ้าหมวดหมู่ใดกี่ชิ้น"
        />

        {cabinetsToRestock.length === 0 ? (
          <EmptyContent title="ไม่มีตู้ที่ต้องเติมผ้าในรอบนี้" sx={{ py: 6 }} />
        ) : (
          <Box sx={{ px: 2, pb: 2 }}>
            {cabinetsToRestock.map((cab) => (
              <Accordion key={cab.cabinetId} disableGutters>
                <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: 1, pr: 1 }}
                  >
                    <Iconify icon="solar:box-bold-duotone" width={20} sx={{ color: 'warning.main' }} />
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {cab.cabinetName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                        {cab.wardName}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      color="primary"
                      variant="soft"
                      label={`จัดขึ้นรถ ${cab.totalSuggestedLoad} ชิ้น`}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Scrollbar>
                    <TableContainer sx={{ minWidth: 560 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>หมวดหมู่ผ้า</TableCell>
                            <TableCell align="right">par level</TableCell>
                            <TableCell align="right">น่าจะเหลือในตู้</TableCell>
                            <TableCell align="right">ขาด</TableCell>
                            <TableCell align="right">จัดขึ้นรถ</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cab.lines.map((line) => (
                            <TableRow key={line.fabricCategoryId} hover>
                              <TableCell>{line.categoryName}</TableCell>
                              <TableCell align="right">{line.parLevelQty}</TableCell>
                              <TableCell align="right">{line.estimatedInCabinetQty}</TableCell>
                              <TableCell align="right">{line.shortageQty}</TableCell>
                              <TableCell align="right">
                                {line.suggestedLoadQty > 0 ? (
                                  <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                                    {line.suggestedLoadQty}
                                  </Typography>
                                ) : (
                                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                                    —
                                  </Typography>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Scrollbar>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {(cabinetsStocked.length > 0 || cabinetsNoPar.length > 0) && (
          <>
            <Divider sx={{ borderStyle: 'dashed' }} />
            <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {cabinetsStocked.map((cab) => (
                <Chip
                  key={cab.cabinetId}
                  size="small"
                  variant="soft"
                  color="success"
                  icon={<Iconify icon="solar:check-circle-bold-duotone" width={14} />}
                  label={`${cab.cabinetName} (ครบ)`}
                />
              ))}
              {cabinetsNoPar.map((cab) => (
                <Tooltip key={cab.cabinetId} title="ตู้นี้ยังไม่ได้ตั้งค่า par level — ตั้งได้ที่หน้าโครงสร้างโรงพยาบาล">
                  <Chip
                    size="small"
                    variant="soft"
                    color="default"
                    icon={<Iconify icon="solar:danger-triangle-bold-duotone" width={14} />}
                    label={`${cab.cabinetName} (ยังไม่ตั้ง par)`}
                  />
                </Tooltip>
              ))}
            </Box>
          </>
        )}
      </Card>
    </Stack>
  );
}
