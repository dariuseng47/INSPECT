import { CONFIG } from 'src/config-global';

import { AlertsView } from 'src/sections/alerts/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Alert & Exceptions | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.alerts.view">
      <AlertsView />
    </PermissionGuard>
  );
}
