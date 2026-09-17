import { CONFIG } from 'src/config-global';

import { SuperadminListView } from 'src/sections/security/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Superadmin Management | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SuperadminListView />;
}
