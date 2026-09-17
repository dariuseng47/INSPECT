'use client';

import { useMemo } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { fNumber } from 'src/utils/format-number';

import { varAlpha, bgGradient } from 'src/theme/styles';
import { DashboardContent } from 'src/layouts/dashboard';
import { useDashboardSummary } from 'src/actions/hospitals';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { Chart, useChart } from 'src/components/chart';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { useAuthContext } from 'src/auth/hooks';

import { SuperDashboardView } from './super-dashboard-view';
import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

function statusMainColor(theme, status) {
  const colorKey = STATUS_COLOR[status];
  if (!colorKey || colorKey === 'default') return theme.vars.palette.grey[500];
  return theme.vars.palette[colorKey].main;
}

// admin/operator: ภาพรวมของโรงพยาบาลตัวเอง (พฤติกรรมเดิม ไม่เปลี่ยนแปลง)
function HospitalOperationalOverview() {
  const theme = useTheme();
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin } = useEffectiveHospital();

  const { summary, summaryLoading, refreshSummary } = useDashboardSummary(hospitalId);

  // เหตุการณ์ใดก็ตามที่กระทบตัวเลขสรุปหน้าแรก -> รีเฟรชเงียบๆ ทันที
  useSocketEvent('scan:created', refreshSummary);
  useSocketEvent('scan:ward-issue', refreshSummary);
  useSocketEvent('scan:ward-receive', refreshSummary);
  useSocketEvent('fabric:hold', refreshSummary);
  useSocketEvent('fabric:decommission', refreshSummary);
  useSocketEvent('device:status_changed', refreshSummary);

  const totalFabric = useMemo(
    () => summary?.fabricByStatus?.reduce((sum, row) => sum + Number(row.count), 0) ?? 0,
    [summary]
  );
  const onlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'ONLINE')?.count ?? 0,
    [summary]
  );
  const offlineDevices = useMemo(
    () => summary?.devicesByStatus?.find((row) => row.status === 'OFFLINE')?.count ?? 0,
    [summary]
  );

  const chartSeries = useMemo(
    () => summary?.fabricByStatus?.map((row) => Number(row.count)) ?? [],
    [summary]
  );
  const chartColors = useMemo(
    () => summary?.fabricByStatus?.map((row) => statusMainColor(theme, row.status)) ?? [],
    [summary, theme]
  );

  const chartOptions = useChart({
    chart: { sparkline: { enabled: true } },
    colors: chartColors,
    labels: summary?.fabricByStatus?.map((row) => STATUS_LABEL[row.status] ?? row.status) ?? [],
    stroke: { width: 0 },
    tooltip: {
      y: { formatter: (value) => fNumber(value), title: { formatter: (name) => `${name}` } },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            value: { formatter: (value) => fNumber(value) },
            total: {
              label: 'ผ้าทั้งหมด',
              formatter: (w) => fNumber(w.globals.seriesTotals.reduce((a, b) => a + b, 0)),
            },
          },
        },
      },
    },
  });

  return (
    <DashboardContent maxWidth="xl">
      <Box
        sx={{
          ...bgGradient({
            color: `to right, ${theme.vars.palette.primary.darker} 0%, ${theme.vars.palette.primary.main} 100%`,
          }),
          p: { xs: 3, md: 4 },
          mb: { xs: 3, md: 5 },
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          color: 'primary.contrastText',
        }}
      >
        <Iconify
          icon="solar:t-shirt-bold-duotone"
          width={220}
          sx={{
            position: 'absolute',
            right: -30,
            bottom: -50,
            opacity: 0.14,
            color: 'common.white',
            display: { xs: 'none', sm: 'block' },
          }}
        />

        <Stack spacing={1.5} sx={{ position: 'relative', maxWidth: 480 }}>
          <HospitalContextChip
            sx={{
              bgcolor: varAlpha(theme.vars.palette.common.whiteChannel, 0.16),
              color: 'common.white',
              '& .MuiChip-icon': { ml: 1, color: 'common.white' },
            }}
          />
          <Typography variant="h4">
            {user?.full_name ? `สวัสดี, ${user.full_name}` : 'ภาพรวมการทำงาน'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            สรุปสถานะผ้าและอุปกรณ์ล่าสุดของโรงพยาบาลนี้แบบเรียลไทม์
          </Typography>
        </Stack>
      </Box>

      {!hospitalId ? (
        <EmptyContent
          title={isSuperadmin ? 'ยังไม่มีโรงพยาบาลในระบบ' : 'ไม่พบข้อมูลโรงพยาบาลของบัญชีนี้'}
          sx={{ py: 10 }}
        />
      ) : summaryLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:t-shirt-bold-duotone"
                title="ผ้าในระบบทั้งหมด"
                value={totalFabric}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-bold-duotone"
                title="อุปกรณ์ออนไลน์"
                value={onlineDevices}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-minimalistic-broken"
                title="อุปกรณ์ออฟไลน์"
                value={offlineDevices}
                color="error"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:danger-triangle-bold-duotone"
                title="ผ้าข้ามขั้นตอน (7 วันล่าสุด)"
                value={summary?.stepSkippedLast7Days ?? 0}
                color="warning"
              />
            </Grid>
          </Grid>

          <Card>
            <CardHeader title="ผ้าแยกตามสถานะ" subheader="สัดส่วนผ้าทั้งหมดในระบบขณะนี้" />

            {summary?.fabricByStatus?.length ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="center"
                spacing={3}
                sx={{ p: 3 }}
              >
                <Chart
                  type="donut"
                  series={chartSeries}
                  options={chartOptions}
                  width={220}
                  height={220}
                  sx={{ flexShrink: 0 }}
                />

                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ display: { xs: 'none', sm: 'block' }, borderStyle: 'dashed' }}
                />

                <Stack spacing={2} sx={{ width: 1 }}>
                  {summary.fabricByStatus.map((row) => (
                    <Stack key={row.status} direction="row" alignItems="center" spacing={1.5}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: statusMainColor(theme, row.status),
                        }}
                      />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {STATUS_LABEL[row.status] ?? row.status}
                      </Typography>
                      <Typography variant="subtitle2">{fNumber(row.count)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', p: 3, pt: 0 }}>
                ยังไม่มีข้อมูลผ้าในระบบ (รอฟีเจอร์ Fabric & Lot Management)
              </Typography>
            )}
          </Card>
        </>
      )}
    </DashboardContent>
  );
}

export function LmsOverviewView() {
  const { user } = useAuthContext();

  // superadmin เห็นภาพรวมข้ามทุกโรงพยาบาลก่อนเสมอ (ไม่บังคับเลือก รพ. เดียวเหมือน admin/operator)
  if (user?.role === 'SUPERADMIN') {
    return (
      <DashboardContent maxWidth="xl">
        <SuperDashboardView />
      </DashboardContent>
    );
  }

  return <HospitalOperationalOverview />;
}
