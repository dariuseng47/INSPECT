import { CONFIG } from 'src/config-global';

import { PhoneModelDetailsView } from 'src/sections/phone/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `รายละเอียดรุ่นโทรศัพท์ | Dashboard - ${CONFIG.appName}` };

export default function Page({ params }) {
  const { id } = params;
  return (
    <PermissionGuard perm="web.phone.models.view">
      <PhoneModelDetailsView id={id} />
    </PermissionGuard>
  );
}
