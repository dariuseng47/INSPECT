import { useMemo, useCallback } from 'react';

import { useGetMyPermissions } from 'src/actions/permissions';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

// เช็คสิทธิ์ราย menu (web.<module>.view / .edit) ของผู้ใช้ปัจจุบัน
//   const { can, isSuperadmin, ready } = usePermission();
//   can('web.devices.edit')  -> true/false
// superadmin = true เสมอ (ตรงกับ backend hasPermission)
export function usePermission() {
  const { user } = useAuthContext();
  const { myPermissions, myPermissionsLoading } = useGetMyPermissions();

  const isSuperadmin = user?.role === 'SUPERADMIN';

  const grantedKeys = useMemo(
    () => new Set(myPermissions.filter((p) => p.effective).map((p) => p.key)),
    [myPermissions]
  );

  const can = useCallback(
    (permKey) => {
      if (!permKey) return true;
      if (isSuperadmin) return true;
      return grantedKeys.has(permKey);
    },
    [isSuperadmin, grantedKeys]
  );

  return { can, isSuperadmin, ready: !myPermissionsLoading, permissions: myPermissions };
}

// เวอร์ชันสั้นสำหรับเช็คคีย์เดียว: const canEdit = useHasPermission('web.devices.edit');
export function useHasPermission(permKey) {
  const { can } = usePermission();
  return can(permKey);
}
