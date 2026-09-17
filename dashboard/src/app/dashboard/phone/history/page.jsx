import { CONFIG } from 'src/config-global';

import { ScanHistoryView } from 'src/sections/phone/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `ประวัติการสแกน | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.phone.history.view">
      <ScanHistoryView />
    </PermissionGuard>
  );
}
