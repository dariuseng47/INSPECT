import { CONFIG } from 'src/config-global';

import { HospitalListView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Hospital Management | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <HospitalListView />;
}
