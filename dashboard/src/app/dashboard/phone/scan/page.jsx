import { CONFIG } from 'src/config-global';

import { PhoneScanView } from 'src/sections/phone/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `ตรวจสอบรุ่นโทรศัพท์ | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.phone.scan.view">
      <PhoneScanView />
    </PermissionGuard>
  );
}
