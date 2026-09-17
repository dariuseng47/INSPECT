import { CONFIG } from 'src/config-global';

import { OperationsProcessMonitorView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Process Status Monitor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsProcessMonitorView />;
}
