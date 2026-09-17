'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import { useSocketEvent } from 'src/hooks/use-socket-event';

import { varAlpha, bgGradient } from 'src/theme/styles';
import { useGetHospitalsSummary } from 'src/actions/hospitals';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

// ----------------------------------------------------------------------

function HospitalStat({ icon, value, label, color }) {
  return (
    <Stack alignItems="center" spacing={0.5} sx={{ flex: '1 1 0', minWidth: 0 }}>
      <Iconify icon={icon} width={18} sx={{ color: `${color}.main` }} />
      <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography
        variant="caption"
        noWrap
        sx={{ color: 'text.disabled', fontSize: 11, maxWidth: 1 }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

function HospitalSummaryCard({ hospital }) {
  const theme = useTheme();
  const hasIssue = hospital.devicesOffline > 0;

  return (
    <Card
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        transition: theme.transitions.create(['box-shadow', 'transform']),
        '&:hover': {
          boxShadow: theme.customShadows?.z16 ?? theme.shadows[8],
          transform: 'translateY(-3px)',
        },
      }}
    >
      <CardActionArea
        component={RouterLink}
        href={paths.dashboard.hq.hospitalDetails(hospital.id)}
        sx={{ display: 'block' }}
      >
        <Box sx={{ height: 4, bgcolor: hasIssue ? 'error.main' : 'success.main' }} />

        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Stack
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 2,
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'primary.lighter',
                color: 'primary.dark',
              }}
            >
              <Iconify icon="solar:hospital-bold-duotone" width={24} />
            </Stack>
            <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle1" noWrap>
                {hospital.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                {hospital.organizationName}
              </Typography>
            </Stack>
            <Iconify
              icon="eva:arrow-ios-forward-fill"
              width={20}
              sx={{ color: 'text.disabled', flexShrink: 0 }}
            />
          </Stack>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Stack direction="row" alignItems="center">
            <HospitalStat
              icon="solar:t-shirt-bold-duotone"
              value={hospital.fabricCount}
              label="ผ้าในระบบ"
              color="info"
            />
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            <HospitalStat
              icon="solar:users-group-rounded-bold-duotone"
              value={hospital.userCount}
              label="ผู้ใช้งาน"
              color="warning"
            />
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
            <HospitalStat
              icon={hasIssue ? 'solar:wi-fi-router-minimalistic-broken' : 'solar:wi-fi-router-bold-duotone'}
              value={hasIssue ? `${hospital.devicesOnline}/${hospital.devicesOnline + hospital.devicesOffline}` : hospital.devicesOnline}
              label="อุปกรณ์ออนไลน์"
              color={hasIssue ? 'error' : 'success'}
            />
          </Stack>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

export function SuperDashboardView() {
  const theme = useTheme();

  const { hospitalsSummary, totals, hospitalsSummaryLoading, refreshHospitalsSummary } =
    useGetHospitalsSummary();

  // superadmin socket join ห้องของทุกโรงพยาบาลไว้แล้วตอน connect (ดู server/src/sockets/index.js)
  // -> เหตุการณ์จากโรงพยาบาลไหนก็ตามอัปเดตภาพรวมนี้ได้ทันที
  useSocketEvent('scan:created', refreshHospitalsSummary);
  useSocketEvent('scan:ward-issue', refreshHospitalsSummary);
  useSocketEvent('scan:ward-receive', refreshHospitalsSummary);
  useSocketEvent('fabric:hold', refreshHospitalsSummary);
  useSocketEvent('fabric:decommission', refreshHospitalsSummary);
  useSocketEvent('device:status_changed', refreshHospitalsSummary);

  return (
    <Stack spacing={4}>
      <Box
        sx={{
          ...bgGradient({
            color: `to right, ${theme.vars.palette.grey[900]} 0%, ${varAlpha(
              theme.vars.palette.primary.darkerChannel,
              0.92
            )} 100%`,
          }),
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          color: 'common.white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Iconify
          icon="solar:buildings-3-bold-duotone"
          width={200}
          sx={{
            position: 'absolute',
            right: -20,
            bottom: -60,
            opacity: 0.12,
            color: 'common.white',
            display: { xs: 'none', sm: 'block' },
          }}
        />

        <Stack spacing={0.5} sx={{ position: 'relative' }}>
          <Typography variant="h4">ภาพรวมเครือข่ายโรงพยาบาล</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            ติดตามผ้าและอุปกรณ์ของทุกโรงพยาบาลในเครือข่ายจากที่เดียว
          </Typography>
        </Stack>

        <Button
          component={RouterLink}
          href={paths.dashboard.hq.hospitals}
          variant="contained"
          color="primary"
          startIcon={<Iconify icon="solar:buildings-3-bold-duotone" />}
          sx={{ position: 'relative' }}
        >
          จัดการโรงพยาบาล
        </Button>
      </Box>

      {hospitalsSummaryLoading ? (
        <LoadingScreen />
      ) : hospitalsSummary.length === 0 ? (
        <EmptyContent
          title="ยังไม่มีโรงพยาบาลในระบบ"
          description="เริ่มต้นด้วยการเพิ่มโรงพยาบาลแรกที่หน้า จัดการโรงพยาบาล"
          sx={{ py: 10 }}
        />
      ) : (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:buildings-3-bold-duotone"
                title="โรงพยาบาลทั้งหมด"
                value={totals?.hospitalCount ?? 0}
                color="primary"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:t-shirt-bold-duotone"
                title="ผ้าในระบบทั้งหมด"
                value={totals?.fabricCount ?? 0}
                color="info"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:wi-fi-router-bold-duotone"
                title="อุปกรณ์ออนไลน์รวม"
                value={totals?.devicesOnline ?? 0}
                color="success"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon="solar:users-group-rounded-bold-duotone"
                title="ผู้ใช้งานทั้งหมด"
                value={totals?.userCount ?? 0}
                color="warning"
              />
            </Grid>
          </Grid>

          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:buildings-2-bold-duotone" width={20} sx={{ color: 'text.secondary' }} />
              <Typography variant="h6">แยกตามโรงพยาบาล</Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                — คลิกเพื่อดูรายละเอียด
              </Typography>
            </Stack>
            <Grid container spacing={2.5}>
              {hospitalsSummary.map((hospital) => (
                <Grid item xs={12} sm={6} md={4} key={hospital.id}>
                  <HospitalSummaryCard hospital={hospital} />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </>
      )}
    </Stack>
  );
}
