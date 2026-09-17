import { CONFIG } from 'src/config-global';
import { DashboardLayout } from 'src/layouts/dashboard';
import { HospitalWorkspaceProvider } from 'src/contexts/hospital-workspace-context';

import { AuthGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export default function Layout({ children }) {
  if (CONFIG.auth.skip) {
    return (
      <HospitalWorkspaceProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </HospitalWorkspaceProvider>
    );
  }

  return (
    <AuthGuard>
      <HospitalWorkspaceProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </HospitalWorkspaceProvider>
    </AuthGuard>
  );
}
