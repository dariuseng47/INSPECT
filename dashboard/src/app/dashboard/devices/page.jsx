import { CONFIG } from 'src/config-global';

import { DeviceListView } from 'src/sections/devices/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `อุปกรณ์ & สัญญาณ RFID | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.devices.view">
      <DeviceListView />
    </PermissionGuard>
  );
}
