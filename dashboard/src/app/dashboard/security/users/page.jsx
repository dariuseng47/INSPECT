import { CONFIG } from 'src/config-global';

import { UserListView } from 'src/sections/security/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `User & Role Management | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.security.users.view">
      <UserListView />
    </PermissionGuard>
  );
}
