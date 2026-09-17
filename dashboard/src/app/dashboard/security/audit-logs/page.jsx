import { CONFIG } from 'src/config-global';

import { AuditLogListView } from 'src/sections/security/view/audit-log-list-view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Security Audit Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.security.audit_logs.view">
      <AuditLogListView />
    </PermissionGuard>
  );
}
