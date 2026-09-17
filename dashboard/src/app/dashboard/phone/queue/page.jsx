import { CONFIG } from 'src/config-global';

import { UnidentifiedQueueView } from 'src/sections/phone/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `คิวตรวจสอบ | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.phone.queue.view">
      <UnidentifiedQueueView />
    </PermissionGuard>
  );
}
