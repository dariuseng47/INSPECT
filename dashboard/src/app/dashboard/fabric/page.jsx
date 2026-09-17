import { CONFIG } from 'src/config-global';

import { FabricInventoryView } from 'src/sections/fabric/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Fabric Inventory | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.fabric.inventory.view">
      <FabricInventoryView />
    </PermissionGuard>
  );
}
