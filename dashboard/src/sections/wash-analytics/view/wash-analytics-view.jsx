'use client';

import { useMemo } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetWashAnalytics } from 'src/actions/washAnalytics';

import { StatCard } from 'src/components/stat-card';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

// ----------------------------------------------------------------------

function wearColor(pct) {
  if (pct >= 100) return 'error';
  if (pct >= 80) return 'warning';
  return 'primary';
}

export function WashAnalyticsView() {
  const { hospitalId } = useEffectiveHospital();

  const { categorySummary, topWornItems, washAnalyticsLoading } = useGetWashAnalytics(hospitalId);

  const totals = useMemo(() => {
    const totalItems = categorySummary.reduce((sum, c) => sum + Number(c.item_count), 0);
    const nearCount = categorySummary.reduce((sum, c) => sum + Number(c.near_threshold_count), 0);
    const overCount = categorySummary.reduce((sum, c) => sum + Number(c.over_threshold_count), 0);
    const weightedWashSum = categorySummary.reduce(
      (sum, c) => sum + Number(c.avg_wash_count) * Number(c.item_count),
      0
    );
    const avgWashCount = totalItems > 0 ? (weightedWashSum / totalItems).toFixed(1) : '0.0';
    return { totalItems, nearCount, overCount, avgWashCount };
  }, [categorySummary]);

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="วิเคราะห์การซัก & ทรัพย์สิน"
        links={[{ name: 'แดชบอร์ดโรงพยาบาล' }, { name: 'วิเคราะห์การซัก & ทรัพย์สิน' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : washAnalyticsLoading ? (
        <LoadingScreen />
      ) : categorySummary.length === 0 ? (
        <EmptyContent title="ยังไม่มีหมวดหมู่ผ้าในระบบ" sx={{ py: 10 }} />
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard icon="solar:t-shirt-bold-duotone" title="ผ้าทั้งหมด" value={totals.totalItems} color="primary" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:refresh-circle-bold-duotone"
                title="รอบซักเฉลี่ย"
                value={totals.avgWashCount}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:danger-circle-bold-duotone"
                title="ใกล้ครบรอบซัก"
                value={totals.nearCount}
                color="warning"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:trash-bin-2-bold-duotone"
                title="ครบ/เกินรอบซักแล้ว"
                value={totals.overCount}
                color="error"
              />
            </Grid>
          </Grid>

          <Card>
            <CardHeader
              title="สรุปตามหมวดหมู่ผ้า"
              subheader="เทียบรอบซักเฉลี่ยกับ Max Allowed Wash Cycles ของแต่ละหมวดหมู่"
            />
            <Scrollbar>
              <TableContainer sx={{ minWidth: 720 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>หมวดหมู่ผ้า</TableCell>
                      <TableCell align="right">รอบซักสูงสุด</TableCell>
                      <TableCell align="right">จำนวนผ้า</TableCell>
                      <TableCell align="right">รอบซักเฉลี่ย</TableCell>
                      <TableCell align="right">ใกล้ครบ</TableCell>
                      <TableCell align="right">ครบ/เกิน</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categorySummary.map((row) => (
                      <TableRow key={row.category_id} hover>
                        <TableCell>{row.category_name}</TableCell>
                        <TableCell align="right">{row.max_wash_cycles ?? 'ไม่กำหนด'}</TableCell>
                        <TableCell align="right">{row.item_count}</TableCell>
                        <TableCell align="right">{row.avg_wash_count}</TableCell>
                        <TableCell align="right">
                          {Number(row.near_threshold_count) > 0 ? (
                            <Chip size="small" variant="soft" color="warning" label={row.near_threshold_count} />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {Number(row.over_threshold_count) > 0 ? (
                            <Chip size="small" variant="soft" color="error" label={row.over_threshold_count} />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          </Card>

          <Card>
            <CardHeader
              title="ผ้าที่ใกล้ครบรอบซักมากที่สุด"
              subheader="10 อันดับผ้าที่มีสัดส่วนรอบซักเทียบกับเกณฑ์สูงสุด (เฉพาะหมวดหมู่ที่ตั้งเกณฑ์ไว้)"
            />
            {topWornItems.length === 0 ? (
              <EmptyContent title="ยังไม่มีข้อมูลรอบซัก" sx={{ py: 8 }} />
            ) : (
              <Scrollbar>
                <TableContainer sx={{ minWidth: 640 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>รหัส EPC</TableCell>
                        <TableCell>หมวดหมู่</TableCell>
                        <TableCell sx={{ width: 260 }}>รอบซัก</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topWornItems.map((item) => {
                        const pct = Number(item.pct_of_max);
                        return (
                          <TableRow key={item.id} hover>
                            <TableCell>{item.epc_code}</TableCell>
                            <TableCell>{item.category_name}</TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between">
                                  <span>
                                    {item.wash_count} / {item.max_wash_cycles}
                                  </span>
                                  <span>{pct}%</span>
                                </Stack>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(pct, 100)}
                                  color={wearColor(pct)}
                                  sx={{ height: 6, borderRadius: 1 }}
                                />
                              </Stack>
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
        </Stack>
      )}
    </DashboardContent>
  );
}
