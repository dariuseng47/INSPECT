import { CONFIG } from 'src/config-global';

import { FabricDecommissionedView } from 'src/sections/fabric/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Decommissioned Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.fabric.decommissioned.view">
      <FabricDecommissionedView />
    </PermissionGuard>
  );
}
