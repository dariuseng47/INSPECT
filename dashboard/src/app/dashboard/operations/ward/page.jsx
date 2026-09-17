import { CONFIG } from 'src/config-global';

import { OperationsWardView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Ward Dispatch & Receive | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.operations.ward.view">
      <OperationsWardView />
    </PermissionGuard>
  );
}
