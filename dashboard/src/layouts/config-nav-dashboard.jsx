import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// โครงเมนูตาม PROMPT_MASTER.md — แต่ละหมวดใหญ่เป็นเมนูหลักที่ย่อเมนูรองไว้ (คลิกเพื่อขยาย)
// การแสดงเมนูอิงจาก "สิทธิ์ราย menu" (web.<module>.view) ที่ effective ของผู้ใช้ ไม่ใช่ role ตรงๆ
// อีกต่อไป (ดู server/src/config/menuCatalog.js) — ยกเว้นหมวด HQ ที่เป็น boundary ตายตัวของ SUPERADMIN
const icon = (name) => <Iconify icon={name} width={22} />;

// perm = perm_key ที่ต้อง effective ถึงจะเห็นเมนูนี้ (undefined = เห็นได้ทุกคนที่ล็อกอิน)
function buildItems() {
  return [
    {
      title: 'ศูนย์บริหารเครือข่าย',
      path: paths.dashboard.root,
      icon: icon('solar:buildings-3-bold-duotone'),
      superadminOnly: true,
      children: [
        {
          title: 'ภาพรวมการทำงาน',
          path: paths.dashboard.root,
          icon: icon('solar:pie-chart-2-bold-duotone'),
        },
        {
          title: 'จัดการโรงพยาบาล',
          path: paths.dashboard.hq.hospitals,
          icon: icon('solar:hospital-bold-duotone'),
        },
        {
          title: 'โอนย้ายผ้าข้ามโรงพยาบาล',
          path: paths.dashboard.hq.transfers,
          icon: icon('solar:transfer-horizontal-bold-duotone'),
        },
        {
          title: 'ตั้งค่าระบบส่วนกลาง',
          path: paths.dashboard.hq.config,
          icon: icon('solar:settings-bold-duotone'),
        },
      ],
    },
    {
      title: 'แดชบอร์ดโรงพยาบาล',
      path: paths.dashboard.root,
      icon: icon('solar:widget-5-bold-duotone'),
      children: [
        {
          title: 'แดชบอร์ดโรงพยาบาล',
          path: paths.dashboard.root,
          icon: icon('solar:pie-chart-2-bold-duotone'),
          perm: 'web.dashboard.overview.view',
          hideForSuperadmin: true,
        },
        {
          title: 'แดชบอร์ด',
          path: paths.dashboard.hospitalProfile,
          icon: icon('solar:widget-5-bold-duotone'),
          perm: 'web.dashboard.hospital_profile.view',
        },
        {
          title: 'แจ้งเตือน & ข้อยกเว้น',
          path: paths.dashboard.alerts,
          icon: icon('solar:bell-bing-bold-duotone'),
          perm: 'web.alerts.view',
        },
        {
          title: 'วิเคราะห์การซัก & ทรัพย์สิน',
          path: paths.dashboard.washAnalytics,
          icon: icon('solar:chart-square-bold-duotone'),
          perm: 'web.wash_analytics.view',
        },
        {
          title: 'ติดตามสถานะกระบวนการ',
          path: paths.dashboard.operations.root,
          icon: icon('solar:radar-2-bold-duotone'),
          perm: 'web.tracking.view',
        },
      ],
    },
    {
      title: 'ปฏิบัติการ & ติดตามผ้า',
      path: paths.dashboard.operations.washReceive,
      icon: icon('solar:routing-2-bold-duotone'),
      children: [
        {
          title: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า',
          path: paths.dashboard.operations.washReceive,
          icon: icon('solar:scale-bold-duotone'),
          perm: 'web.operations.wash_receive.view',
        },
        {
          title: 'สแกนเข้าสต๊อค',
          path: paths.dashboard.operations.stockScan,
          icon: icon('solar:qr-code-bold-duotone'),
          perm: 'web.operations.stock_scan.view',
        },
        {
          title: 'รับ-ส่งผ้าประจำวอร์ด',
          path: paths.dashboard.operations.ward,
          icon: icon('solar:delivery-bold-duotone'),
          perm: 'web.operations.ward.view',
        },
        {
          title: 'ประวัติ & วิเคราะห์การเติมผ้า',
          path: paths.dashboard.operations.restockReport,
          icon: icon('solar:chart-2-bold-duotone'),
          perm: 'web.operations.restock_report.view',
        },
      ],
    },
    {
      title: 'จัดการผ้าและล็อต',
      path: paths.dashboard.fabric.root,
      icon: icon('solar:t-shirt-bold-duotone'),
      children: [
        {
          title: 'คลังผ้าทั้งหมด',
          path: paths.dashboard.fabric.root,
          icon: icon('solar:box-bold-duotone'),
          perm: 'web.fabric.inventory.view',
        },
        {
          title: 'ลงทะเบียนผ้า / ล็อต',
          path: paths.dashboard.fabric.new,
          icon: icon('solar:add-square-bold-duotone'),
          perm: 'web.fabric.register.view',
        },
        {
          title: 'รายการพัก & ชำรุด',
          path: paths.dashboard.fabric.hold,
          icon: icon('solar:pause-circle-bold-duotone'),
          perm: 'web.fabric.hold.view',
        },
        {
          title: 'ประวัติผ้าที่จำหน่ายออก',
          path: paths.dashboard.fabric.decommissioned,
          icon: icon('solar:trash-bin-minimalistic-bold-duotone'),
          perm: 'web.fabric.decommissioned.view',
        },
      ],
    },
    {
      title: 'โครงสร้างโรงพยาบาล',
      path: paths.dashboard.organization.tree,
      icon: icon('solar:city-bold-duotone'),
      perm: 'web.organization.view',
    },
    {
      title: 'อุปกรณ์ & สัญญาณ RFID',
      path: paths.dashboard.devices,
      icon: icon('solar:cpu-bolt-bold-duotone'),
      perm: 'web.devices.view',
    },
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
          title: 'ตั้งค่าเวลาค้างสถานะ',
          path: paths.dashboard.security.timeouts,
          icon: icon('solar:clock-circle-bold-duotone'),
          perm: 'web.security.timeouts.view',
        },
        {
          title: 'ประวัติการใช้งานระบบ',
          path: paths.dashboard.security.auditLogs,
          icon: icon('solar:document-text-bold-duotone'),
          perm: 'web.security.audit_logs.view',
        },
        {
          title: 'ข้อมูลชนกันจากออฟไลน์',
          path: paths.dashboard.security.syncConflicts,
          icon: icon('solar:shuffle-bold-duotone'),
          perm: 'web.security.sync_conflicts.view',
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
      if (item.superadminOnly) return isSuperadmin ? item : null;
      if (item.children) {
        const children = item.children.filter(visibleLeaf);
        if (!children.length) return null;
        // path ของเมนูหลัก = เมนูย่อยตัวแรกที่มองเห็น — กันชนกับ path ของเมนู HQ (root)
        // และกันลิงก์ไปหน้าที่ผู้ใช้ไม่มีสิทธิ์
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
    {
      subheader: 'ข้อมูลระบบ',
      items: [
        {
          title: 'แผนผังเว็บไซต์',
          path: paths.dashboard.siteMap,
          icon: icon('solar:widget-2-bold-duotone'),
        },
      ],
    },
  ];
}

// เผื่อโค้ดที่อื่นยัง import navData แบบ static อยู่ — default ให้เห็นทุกเมนู (ใช้ตอนยังไม่รู้สิทธิ์)
export const navData = getNavData(undefined, {
  permissions: [{ key: '*', effective: true }],
});
