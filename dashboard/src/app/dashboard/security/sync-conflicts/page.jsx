import { CONFIG } from 'src/config-global';

import { SyncConflictsView } from 'src/sections/security/view/sync-conflicts-view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Sync Conflicts | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.security.sync_conflicts.view">
      <SyncConflictsView />
    </PermissionGuard>
  );
}
