'use client';

import { DashboardContent } from 'src/layouts/dashboard';

import { HospitalProfileView } from 'src/sections/hq/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <PermissionGuard perm="web.dashboard.hospital_profile.view">
      <DashboardContent maxWidth="xl">
        <HospitalProfileView />
      </DashboardContent>
    </PermissionGuard>
  );
}
