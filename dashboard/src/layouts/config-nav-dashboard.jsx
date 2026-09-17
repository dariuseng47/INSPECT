import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// การแสดงเมนูอิงจาก "สิทธิ์ราย menu" (web.<module>.view) ที่ effective ของผู้ใช้ ไม่ใช่ role ตรงๆ
// (ดู server/src/config/menuCatalog.js)
const icon = (name) => <Iconify icon={name} width={22} />;

// perm = perm_key ที่ต้อง effective ถึงจะเห็นเมนูนี้ (undefined = เห็นได้ทุกคนที่ล็อกอิน)
function buildItems() {
  return [
    {
      title: 'ความปลอดภัย & ตั้งค่าระบบ',
      path: paths.dashboard.security.users,
      icon: icon('solar:shield-keyhole-bold-duotone'),
      children: [
        {
          title: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
          path: paths.dashboard.security.users,
          icon: icon('solar:users-group-rounded-bold-duotone'),
          perm: 'web.security.users.view',
        },
        {
          title: 'ประวัติการใช้งานระบบ',
          path: paths.dashboard.security.auditLogs,
          icon: icon('solar:document-text-bold-duotone'),
          perm: 'web.security.audit_logs.view',
        },
        {
          title: 'Popup หลัง Login',
          path: paths.dashboard.security.loginPopups,
          icon: icon('solar:gallery-wide-bold-duotone'),
          superadminOnly: true,
        },
      ],
    },
  ];
}

// permissions = array จาก useGetMyPermissions() ([{ key, effective, ... }])
export function getNavData(role, { permissions = [] } = {}) {
  const isSuperadmin = role === 'SUPERADMIN';
  const allowAll = permissions.some((p) => p.key === '*' && p.effective);
  const grantedKeys = new Set(permissions.filter((p) => p.effective).map((p) => p.key));
  const can = (perm) => !perm || isSuperadmin || allowAll || grantedKeys.has(perm);

  const visibleLeaf = (item) => {
    if (item.superadminOnly && !isSuperadmin) return false;
    if (item.hideForSuperadmin && isSuperadmin) return false;
    return can(item.perm);
  };

  const items = buildItems()
    .map((item) => {
      if (item.children) {
        const children = item.children.filter(visibleLeaf);
        if (!children.length) return null;
        return { ...item, path: children[0].path, children };
      }
      return visibleLeaf(item) ? item : null;
    })
    .filter(Boolean);

  return [
    { subheader: 'เมนูใช้งานระบบ', items },
    ...(isSuperadmin
      ? [
          {
            subheader: 'ตั้งค่า Superadmin',
            items: [
              {
                title: 'จัดการบัญชี Superadmin',
                path: paths.dashboard.settings.superadmin,
                icon: icon('solar:shield-star-bold-duotone'),
              },
            ],
          },
        ]
      : []),
  ];
}

// เผื่อโค้ดที่อื่นยัง import navData แบบ static อยู่ — default ให้เห็นทุกเมนู (ใช้ตอนยังไม่รู้สิทธิ์)
export const navData = getNavData(undefined, {
  permissions: [{ key: '*', effective: true }],
});
