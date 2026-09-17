import { CONFIG } from 'src/config-global';

import { FabricRegisterView } from 'src/sections/fabric/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Register Fabric / Lot | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.fabric.register.view">
      <FabricRegisterView />
    </PermissionGuard>
  );
}
