// ============================================================================
// Menu permission catalogue — single source of truth ของสิทธิ์ราย "เมนู" ฝั่งเว็บ (channel: 'web')
//
// แต่ละโมดูลสร้าง perm_key เป็น `<base>.<action>` โดย action ∈ {'view','edit'}
//   - view  = เห็นเมนู / เปิดหน้า / อ่านข้อมูล
//   - edit  = สร้าง/แก้ไข/ลบ ภายในเมนูนั้น (write ทุกชนิด)
//
// superadmin -> hasPermission() ลัดคืน true เสมอ (ไม่แตะ catalogue นี้)
// ที่เหลือ configure ได้ผ่าน user_permission_overrides ตามกฎ delegation (ดู users.controller.js)
// ============================================================================

/**
 * @typedef {Object} MenuModule
 * @property {string} base        prefix ของ perm_key เช่น 'web.security.users'
 * @property {'web'} channel
 * @property {string} category    กลุ่มสำหรับจัดหน้าจอตั้งค่า
 * @property {string} label       ชื่อเมนูภาษาไทย (ตรงกับ nav จริง)
 * @property {Array<'view'|'edit'>} actions
 * @property {{ADMIN?: Array<'view'|'edit'>}} roleDefaults
 *           สิทธิ์ตั้งต้นต่อ role (baseline ก่อนโดน override) — ไม่ระบุ = ไม่ได้ default
 */

const VIEW = ['view'];
const VIEW_EDIT = ['view', 'edit'];

/** @type {MenuModule[]} */
export const MENU_MODULES = [
  {
    base: 'web.security.users',
    channel: 'web',
    category: 'security',
    label: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
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
];

const CATEGORY_LABELS = {
  security: 'ความปลอดภัย & ตั้งค่าระบบ',
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
export const ROLE_DEFAULT_MENU_PERMISSIONS = ['ADMIN'].flatMap((role) =>
  MENU_PERMISSIONS.filter((p) => p.isRoleDefault(role)).map((p) => ({ role, permKey: p.key }))
);
