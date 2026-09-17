import { CONFIG } from 'src/config-global';

import { SiteMapView } from 'src/sections/site-map/view';

// ----------------------------------------------------------------------

export const metadata = { title: `แผนผังเว็บไซต์ | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SiteMapView />;
}
