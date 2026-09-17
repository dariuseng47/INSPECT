// ============================================================================
// Menu permission catalogue — single source of truth ของสิทธิ์ราย "เมนู"
// ทั้งฝั่งเว็บ (channel: 'web') และเครื่องพกพา (channel: 'handheld')
//
// แต่ละโมดูลสร้าง perm_key เป็น `<base>.<action>` โดย action ∈ {'view','edit'}
//   - view  = เห็นเมนู / เปิดหน้า / อ่านข้อมูล
//   - edit  = สร้าง/แก้ไข/ลบ ภายในเมนูนั้น (write ทุกชนิด)
// โมดูลที่เป็นรายงาน/log อ่านอย่างเดียว จะมีแค่ ['view']
//
// ความสัมพันธ์กับ docs/rbac-permissions.md:
//   - superadmin  -> hasPermission() ลัดคืน true เสมอ (ไม่แตะ catalogue นี้)
//   - HQ menu (ศูนย์บริหารเครือข่าย) = hard-coded boundary เฉพาะ superadmin ไม่อยู่ใน catalogue
//   - ที่เหลือ configure ได้ผ่าน user_permission_overrides ตามกฎ delegation เดิม
//
// channel 'web' กับ 'handheld' แยกกันอิสระ 100% — เปิดเว็บให้ไม่ได้แปลว่าเปิด handheld ให้
// การใช้ handheld ต้องผ่าน master switch users.handheld_enabled อีกชั้นก่อนถึง key เหล่านี้
// ============================================================================

/**
 * @typedef {Object} MenuModule
 * @property {string} base        prefix ของ perm_key เช่น 'web.fabric.inventory'
 * @property {'web'|'handheld'} channel
 * @property {string} category    กลุ่มสำหรับจัดหน้าจอตั้งค่า
 * @property {string} label       ชื่อเมนูภาษาไทย (ตรงกับ nav จริง)
 * @property {Array<'view'|'edit'>} actions
 * @property {{ADMIN?: Array<'view'|'edit'>, OPERATOR?: Array<'view'|'edit'>}} roleDefaults
 *           สิทธิ์ตั้งต้นต่อ role (baseline ก่อนโดน override) — ไม่ระบุ = ไม่ได้ default
 */

const VIEW = ['view'];
const VIEW_EDIT = ['view', 'edit'];

/** @type {MenuModule[]} */
export const MENU_MODULES = [
  // ---------- WEB : แดชบอร์ดโรงพยาบาล ----------
  {
    base: 'web.dashboard.overview',
    channel: 'web',
    category: 'dashboard',
    label: 'แดชบอร์ดโรงพยาบาล',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },
  {
    base: 'web.dashboard.hospital_profile',
    channel: 'web',
    category: 'dashboard',
    label: 'แดชบอร์ด (โปรไฟล์โรงพยาบาล)',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW },
  },
  {
    base: 'web.alerts',
    channel: 'web',
    category: 'dashboard',
    label: 'แจ้งเตือน & ข้อยกเว้น',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },
  {
    base: 'web.wash_analytics',
    channel: 'web',
    category: 'dashboard',
    label: 'วิเคราะห์การซัก & ทรัพย์สิน',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },
  {
    base: 'web.tracking',
    channel: 'web',
    category: 'dashboard',
    label: 'ติดตามสถานะกระบวนการ',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },

  // ---------- WEB : ปฏิบัติการ & ติดตามผ้า ----------
  {
    base: 'web.operations.wash_receive',
    channel: 'web',
    category: 'operations',
    label: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'web.operations.stock_scan',
    channel: 'web',
    category: 'operations',
    label: 'สแกนเข้าสต๊อค',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'web.operations.ward',
    channel: 'web',
    category: 'operations',
    label: 'รับ-ส่งผ้าประจำวอร์ด',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'web.operations.restock_report',
    channel: 'web',
    category: 'operations',
    label: 'ประวัติ & วิเคราะห์การเติมผ้า',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },

  // ---------- WEB : จัดการผ้าและล็อต ----------
  {
    base: 'web.fabric.inventory',
    channel: 'web',
    category: 'fabric',
    label: 'คลังผ้าทั้งหมด',
    // edit = เปลี่ยนสถานะผ้าด้วยมือจาก popup (เดิม fabric.item.status_change)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW },
  },
  {
    base: 'web.fabric.register',
    channel: 'web',
    category: 'fabric',
    label: 'ลงทะเบียนผ้า / ล็อต',
    // edit = ลงทะเบียนล็อตผ้าใหม่ (เดิม fabric.lot.create)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'web.fabric.hold',
    channel: 'web',
    category: 'fabric',
    label: 'รายการพัก & ชำรุด',
    // edit = พักใช้งาน / แทงชำรุด (เดิม fabric.item.hold)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'web.fabric.decommissioned',
    channel: 'web',
    category: 'fabric',
    label: 'ประวัติผ้าที่จำหน่ายออก',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },

  // ---------- WEB : โครงสร้าง & อุปกรณ์ ----------
  {
    base: 'web.organization',
    channel: 'web',
    category: 'structure',
    label: 'โครงสร้างโรงพยาบาล',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'web.devices',
    channel: 'web',
    category: 'device',
    label: 'อุปกรณ์ & สัญญาณ RFID',
    // edit = แก้ config อุปกรณ์ (ประเภท/RSSI/เครือข่าย/scan profile), เพิ่ม-ลบอุปกรณ์
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'web.devices.caretaker',
    channel: 'web',
    category: 'device',
    label: 'ข้อมูลผู้ดูแลอุปกรณ์ (ชื่อ/เบอร์โทร)',
    // edit-only sub-key (เดิม device.caretaker.update) — operator ได้รับแยกจาก config อุปกรณ์
    actions: ['edit'],
    roleDefaults: { ADMIN: ['edit'] },
  },

  // ---------- WEB : ความปลอดภัย & ตั้งค่าระบบ ----------
  {
    base: 'web.security.users',
    channel: 'web',
    category: 'security',
    label: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'web.security.timeouts',
    channel: 'web',
    category: 'security',
    label: 'ตั้งค่าเวลาค้างสถานะ',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'web.security.audit_logs',
    channel: 'web',
    category: 'security',
    label: 'ประวัติการใช้งานระบบ',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW },
  },
  {
    base: 'web.security.sync_conflicts',
    channel: 'web',
    category: 'security',
    label: 'ข้อมูลชนกันจากออฟไลน์',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },

  // ---------- HANDHELD ----------
  {
    base: 'handheld.inventory',
    channel: 'handheld',
    category: 'inventory',
    label: 'คลังผ้า (ค้นหา / รายชิ้น)',
    // edit = ลงทะเบียนผ้าเข้าคลังจากเครื่อง (เดิม fabric.lot.create)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'handheld.ward',
    channel: 'handheld',
    category: 'operations',
    label: 'รับ-ส่งผ้าวอร์ด',
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'handheld.ward_history',
    channel: 'handheld',
    category: 'operations',
    label: 'ประวัติการจ่ายผ้า',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },
  {
    base: 'handheld.status_change',
    channel: 'handheld',
    category: 'fabric',
    label: 'เปลี่ยนสถานะผ้า',
    // edit = เปลี่ยนสถานะผ้าด้วยมือ (เดิม fabric.item.status_change)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT },
  },
  {
    base: 'handheld.hold',
    channel: 'handheld',
    category: 'fabric',
    label: 'พัก & ชำรุด',
    // edit = พักใช้งาน / แทงชำรุด (เดิม fabric.item.hold)
    actions: VIEW_EDIT,
    roleDefaults: { ADMIN: VIEW_EDIT, OPERATOR: VIEW_EDIT },
  },
  {
    base: 'handheld.location',
    channel: 'handheld',
    category: 'inventory',
    label: 'ค้นหาตำแหน่งผ้า',
    actions: VIEW,
    roleDefaults: { ADMIN: VIEW, OPERATOR: VIEW },
  },
];

const CATEGORY_LABELS = {
  dashboard: 'แดชบอร์ดโรงพยาบาล',
  operations: 'ปฏิบัติการ & ติดตามผ้า',
  fabric: 'จัดการผ้าและล็อต',
  structure: 'โครงสร้างโรงพยาบาล',
  device: 'อุปกรณ์ & สัญญาณ RFID',
  security: 'ความปลอดภัย & ตั้งค่าระบบ',
  inventory: 'คลังผ้า',
};

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category;
}

// แตกทุกโมดูลเป็นรายการ perm_key เดี่ยว พร้อม metadata ที่หน้าตั้งค่าและ seed migration ใช้ร่วมกัน
export const MENU_PERMISSIONS = MENU_MODULES.flatMap((mod) =>
  mod.actions.map((action) => ({
    key: `${mod.base}.${action}`,
    base: mod.base,
    action,
    channel: mod.channel,
    category: mod.category,
    label: mod.label,
    // ใช้เป็น permissions.category ใน DB — คงรูปแบบ '<channel>:<category>' ให้ group ได้ทั้งสองมิติ
    dbCategory: `${mod.channel}:${mod.category}`,
    isRoleDefault: (role) => (mod.roleDefaults[role] ?? []).includes(action),
  }))
);

export const MENU_PERMISSION_KEYS = new Set(MENU_PERMISSIONS.map((p) => p.key));

// role_default_permissions ที่ควรมีในระบบ (ใช้โดย migration seed และ test)
export const ROLE_DEFAULT_MENU_PERMISSIONS = ['ADMIN', 'OPERATOR'].flatMap((role) =>
  MENU_PERMISSIONS.filter((p) => p.isRoleDefault(role)).map((p) => ({ role, permKey: p.key }))
);

// ----------------------------------------------------------------------------
// Remap คีย์เดิม (ก่อน migration 028) -> คีย์เมนูใหม่ 1..n อัน
// ใช้ 2 ที่:  (ก) migration 028 ย้าย user_permission_overrides เดิม
//            (ข) controller ที่ endpoint ใช้ร่วมกันทั้ง web/handheld -> เช็คแบบ "มีอย่างใดอย่างหนึ่ง"
// ----------------------------------------------------------------------------
export const LEGACY_PERMISSION_REMAP = {
  'fabric.lot.create': ['web.fabric.register.edit', 'handheld.inventory.edit'],
  'fabric.item.hold': ['web.fabric.hold.edit', 'handheld.hold.edit'],
  'fabric.item.status_change': ['web.fabric.inventory.edit', 'handheld.status_change.edit'],
  'device.caretaker.update': ['web.devices.caretaker.edit'],
  'dashboard.hospital_profile.view': ['web.dashboard.hospital_profile.view'],
};
