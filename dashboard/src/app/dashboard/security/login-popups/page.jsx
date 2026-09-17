import { CONFIG } from 'src/config-global';

import { LoginPopupImagesView } from 'src/sections/security/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Login Popup Images | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LoginPopupImagesView />;
}
