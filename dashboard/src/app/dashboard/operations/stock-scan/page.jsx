import { CONFIG } from 'src/config-global';

import { OperationsStockScanView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Scan Into Stock | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.operations.stock_scan.view">
      <OperationsStockScanView />
    </PermissionGuard>
  );
}
