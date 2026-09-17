'use client';

import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { useGetHospitals, useDashboardSummary } from 'src/actions/hospitals';

import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { useAuthContext } from 'src/auth/hooks';

import { QuickLinkCard, HospitalProfileDashboard } from '../hospital-profile-dashboard';

// ----------------------------------------------------------------------

// หน้าแดชบอร์ดโปรไฟล์ของโรงพยาบาลตัวเอง — แยกออกมาจาก /dashboard/hq/hospitals/:id โดยตั้งใจ
// เพราะหน้านั้นอยู่ใต้ hard-coded boundary "non-superadmin ห้ามเห็นเมนู HQ" (docs/rbac-permissions.md)
// หน้านี้เข้าถึงได้ตามสิทธิ์ dashboard.hospital_profile.view ที่เปิด/ปิดได้รายคนแทน (ดู
// PermissionEditorDialog) — backend (requirePermission ที่ /:id/dashboard-summary) เป็นตัวกันจริง
// ส่วน guard ฝั่งนี้แค่ทำ UX ให้สวยขึ้นเวลาไม่มีสิทธิ์ ไม่ใช่ security boundary
export function HospitalProfileView() {
  const { user } = useAuthContext();
  const { hospitalId, isSuperadmin } = useEffectiveHospital();
  const { hospitals, hospitalsLoading } = useGetHospitals(isSuperadmin);
  const { summary, summaryLoading, summaryError } = useDashboardSummary(hospitalId);

  // admin/operator เข้า GET /hospitals (รายละเอียดเต็ม) ไม่ได้ — ใช้ hospital_name ที่มากับ JWT/session
  // ของตัวเองพอ (ดู server/src/controllers/auth.controller.js) ไม่มี organization_name/created_at
  const hospital = isSuperadmin
    ? hospitals.find((h) => h.id === hospitalId)
    : hospitalId
      ? { name: user?.hospital_name }
      : null;

  const forbidden = summaryError?.response?.status === 403;

  const quickLinks = [
    {
      icon: 'solar:t-shirt-bold-duotone',
      title: 'คลังผ้าทั้งหมด',
      description: 'ดูและจัดการผ้าในระบบ',
      href: paths.dashboard.fabric.root,
      roles: ['SUPERADMIN', 'ADMIN', 'OPERATOR'],
    },
    {
      icon: 'solar:users-group-rounded-bold-duotone',
      title: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
      description: 'จัดการ admin / operator ของโรงพยาบาลนี้',
      href: paths.dashboard.security.users,
      roles: ['SUPERADMIN', 'ADMIN'],
    },
    {
      icon: 'solar:city-bold-duotone',
      title: 'โครงสร้างโรงพยาบาล',
      description: 'ผังอาคาร/ชั้น/วอร์ด และตู้เก็บผ้า',
      href: paths.dashboard.organization.tree,
      roles: ['SUPERADMIN', 'ADMIN'],
    },
    {
      icon: 'solar:cpu-bolt-bold-duotone',
      title: 'อุปกรณ์ & สัญญาณ RFID',
      description: 'รายการอุปกรณ์ของโรงพยาบาลนี้',
      href: paths.dashboard.devices,
      roles: ['SUPERADMIN', 'ADMIN'],
    },
  ].filter((link) => link.roles.includes(user?.role));

  return (
    <>
      <CustomBreadcrumbs
        heading="แดชบอร์ด"
        links={[{ name: 'แดชบอร์ดโรงพยาบาล' }, { name: 'แดชบอร์ด' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {hospitalsLoading || summaryLoading ? (
        <LoadingScreen />
      ) : forbidden ? (
        <EmptyContent title="ไม่มีสิทธิ์เข้าถึงหน้านี้" sx={{ py: 10 }} />
      ) : (
        <>
          <HospitalProfileDashboard hospital={hospital} summary={summary} loading={false} />

          {quickLinks.length > 0 && (
            <Stack spacing={2} sx={{ mt: 4 }}>
              <Typography variant="subtitle1">ทางลัด</Typography>
              <Grid container spacing={2.5}>
                {quickLinks.map((link) => (
                  <Grid item xs={12} sm={6} md={4} key={link.href}>
                    <QuickLinkCard {...link} />
                  </Grid>
                ))}
              </Grid>
            </Stack>
          )}
        </>
      )}
    </>
  );
}
