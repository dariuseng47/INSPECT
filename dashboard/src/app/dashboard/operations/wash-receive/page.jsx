import { CONFIG } from 'src/config-global';

import { OperationsWashReceiveView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Wash Receive & Weighing | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.operations.wash_receive.view">
      <OperationsWashReceiveView />
    </PermissionGuard>
  );
}
