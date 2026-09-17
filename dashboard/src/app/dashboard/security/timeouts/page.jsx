import { CONFIG } from 'src/config-global';

import { StatusTimeoutView } from 'src/sections/security/view/status-timeout-view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Status Timeout Settings | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.security.timeouts.view">
      <StatusTimeoutView />
    </PermissionGuard>
  );
}
