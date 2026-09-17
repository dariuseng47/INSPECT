import { CONFIG } from 'src/config-global';

import { TransferListView } from 'src/sections/hq/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Inter-Hospital Transfer | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <TransferListView />;
}
