'use client';

import { useEffect } from 'react';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useGetHospitals, useDashboardSummary } from 'src/actions/hospitals';
import { useHospitalWorkspace } from 'src/contexts/hospital-workspace-context';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';
import { RoleBasedGuard } from 'src/auth/guard';

import { QuickLinkCard, HospitalProfileDashboard } from '../hospital-profile-dashboard';

// ----------------------------------------------------------------------

export function HospitalDetailView({ hospitalId }) {
  const { user } = useAuthContext();
  const { hospitals, hospitalsLoading } = useGetHospitals();
  const { summary, summaryLoading } = useDashboardSummary(hospitalId);
  const { setSelectedHospitalId } = useHospitalWorkspace();

  const hospital = hospitals.find((h) => h.id === hospitalId);

  // sync sidebar switcher ให้ตรงกับโรงพยาบาลที่กำลังดูรายละเอียดอยู่ เผื่อผู้ใช้เปลี่ยนไปกดเมนู
  // อื่นในระบบต่อ (ไม่ใช่แค่ quick-link ด้านล่าง) จะได้เห็นข้อมูลของโรงพยาบาลเดิมที่ตั้งใจดูอยู่
  useEffect(() => {
    if (hospitalId) setSelectedHospitalId(hospitalId);
  }, [hospitalId, setSelectedHospitalId]);

  const withHospitalParam = (path) => `${path}?hospitalId=${hospitalId}`;

  return (
    <RoleBasedGuard hasContent currentRole={user?.role} acceptRoles={['SUPERADMIN']}>
      <>
        <CustomBreadcrumbs
          heading={hospital?.name ?? 'รายละเอียดโรงพยาบาล'}
          links={[
            { name: 'ศูนย์บริหารเครือข่าย', href: paths.dashboard.hq.hospitals },
            { name: 'จัดการโรงพยาบาล', href: paths.dashboard.hq.hospitals },
            { name: hospital?.name ?? '...' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <HospitalProfileDashboard
          hospital={hospital}
          summary={summary}
          loading={hospitalsLoading || summaryLoading}
        />

        {hospital && (
          <Stack spacing={2} sx={{ mt: 4 }}>
            <Typography variant="subtitle1">จัดการโรงพยาบาลนี้</Typography>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6} md={4}>
                <QuickLinkCard
                  icon="solar:users-group-rounded-bold-duotone"
                  title="ผู้ใช้งาน & สิทธิ์การเข้าถึง"
                  description="จัดการ admin / operator ของโรงพยาบาลนี้"
                  href={withHospitalParam(paths.dashboard.security.users)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <QuickLinkCard
                  icon="solar:city-bold-duotone"
                  title="โครงสร้างโรงพยาบาล"
                  description="ผังอาคาร/ชั้น/วอร์ด และตู้เก็บผ้า"
                  href={withHospitalParam(paths.dashboard.organization.tree)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <QuickLinkCard
                  icon="solar:t-shirt-bold-duotone"
                  title="คลังผ้าทั้งหมด"
                  description="ดูและจัดการผ้าในระบบ"
                  href={withHospitalParam(paths.dashboard.fabric.root)}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <QuickLinkCard
                  icon="solar:cpu-bolt-bold-duotone"
                  title="อุปกรณ์ & สัญญาณ RFID"
                  description="รายการอุปกรณ์ของโรงพยาบาลนี้"
                  href={withHospitalParam(paths.dashboard.devices)}
                />
              </Grid>
            </Grid>
          </Stack>
        )}
      </>
    </RoleBasedGuard>
  );
}
