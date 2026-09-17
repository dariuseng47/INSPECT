import { CONFIG } from 'src/config-global';

import { WashAnalyticsView } from 'src/sections/wash-analytics/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Wash & Asset Analytics | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.wash_analytics.view">
      <WashAnalyticsView />
    </PermissionGuard>
  );
}
