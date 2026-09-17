import { CONFIG } from 'src/config-global';

import { FabricHoldView } from 'src/sections/fabric/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Hold & Damaged List | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.fabric.hold.view">
      <FabricHoldView />
    </PermissionGuard>
  );
}
