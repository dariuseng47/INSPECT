import { CONFIG } from 'src/config-global';

import { GlobalSettingsView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Global System Config | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <GlobalSettingsView />;
}
