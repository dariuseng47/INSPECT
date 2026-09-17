import { CONFIG } from 'src/config-global';

import { OperationsRestockReportView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Ward Restock History & Forecast | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.operations.restock_report.view">
      <OperationsRestockReportView />
    </PermissionGuard>
  );
}
