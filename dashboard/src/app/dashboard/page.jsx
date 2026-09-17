import { CONFIG } from 'src/config-global';

import { LmsOverviewView } from 'src/sections/overview/lms';

// ----------------------------------------------------------------------

export const metadata = { title: `Operational Overview - ${CONFIG.appName}` };

export default function Page() {
  return <LmsOverviewView />;
}
