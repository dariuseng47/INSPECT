import { CONFIG } from 'src/config-global';

import { PhoneModelListView } from 'src/sections/phone/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `ข้อมูลรุ่นโทรศัพท์ | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.phone.models.view">
      <PhoneModelListView />
    </PermissionGuard>
  );
}
