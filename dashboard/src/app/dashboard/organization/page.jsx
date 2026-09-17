import { CONFIG } from 'src/config-global';

import { OrganizationTreeView } from 'src/sections/organization/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `ผังโครงสร้างโรงพยาบาล | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.organization.view">
      <OrganizationTreeView />
    </PermissionGuard>
  );
}
