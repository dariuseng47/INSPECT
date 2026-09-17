import { CONFIG } from 'src/config-global';

import { RootGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: CONFIG.appName };

export default function Page() {
  return <RootGuard />;
}
