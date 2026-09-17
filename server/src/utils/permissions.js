import { pool } from '../db/pool.js';
import { MENU_PERMISSIONS, LEGACY_PERMISSION_REMAP } from '../config/menuCatalog.js';

// Permission catalogue — สร้างจาก server/src/config/menuCatalog.js (source of truth)
// ต้องตรงกับที่ seed ไว้ใน db/migrations/028_rbac_scopes_menu_permissions.sql
//
// key รูปแบบ `<channel>.<module>.<action>` โดย channel ∈ {web, handheld}, action ∈ {view, edit}
// ส่วนที่เป็น ❌ ตายตัว (HQ menu, จัดการ admin โดย admin ฯลฯ) เป็น hard-coded check แยกในโค้ด
// ไม่ผ่าน catalogue นี้ — ดู docs/rbac-permissions.md
export const PERMISSION_CATALOG = MENU_PERMISSIONS.map((p) => ({
  key: p.key,
  base: p.base,
  action: p.action,
  channel: p.channel,
  category: p.category,
  label: p.label,
}));

const PERMISSION_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

export function isKnownPermissionKey(permKey) {
  return PERMISSION_KEYS.has(permKey);
}

// endpoint ที่ web กับ handheld ยิงมาที่ path เดียวกัน (เช่น เปลี่ยนสถานะผ้า, พัก/ชำรุด) เช็คด้วย
// คีย์เดิม (ก่อน 028) ผ่าน map นี้ -> แปลว่า "มีสิทธิ์ทำ action นี้จากช่องทางใดช่องทางหนึ่ง"
export function permKeysForLegacy(legacyKey) {
  return LEGACY_PERMISSION_REMAP[legacyKey] ?? [legacyKey];
}

// effective(user, perm_key) ตามสูตรใน docs/rbac-permissions.md:
//   superadmin -> true เสมอ
//   มี override -> ใช้ effect นั้น (GRANT/DENY ชนะ default)
//   ไม่มี override -> ใช้ role_default_permissions ของ role นั้น
export async function hasPermission(userId, role, permKey) {
  if (role === 'SUPERADMIN') return true;

  const [overrides] = await pool.query(
    'SELECT effect FROM user_permission_overrides WHERE user_id = ? AND perm_key = ? LIMIT 1',
    [userId, permKey]
  );
  if (overrides[0]) return overrides[0].effect === 'GRANT';

  const [defaults] = await pool.query(
    'SELECT 1 FROM role_default_permissions WHERE role = ? AND perm_key = ? LIMIT 1',
    [role, permKey]
  );
  return !!defaults[0];
}

// true ถ้ามีสิทธิ์ "อย่างน้อยหนึ่ง" คีย์ในลิสต์ — ใช้กับ endpoint ที่ใช้ร่วมกันหลายช่องทาง
export async function hasAnyPermission(userId, role, permKeys) {
  if (role === 'SUPERADMIN') return true;
  for (const key of permKeys) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasPermission(userId, role, key)) return true;
  }
  return false;
}

// คืนค่า effective permission ของ user ครบทุก key ใน catalogue พร้อมบอกด้วยว่า key ไหน
// ถูก override อยู่ (source: 'override' | 'default') และค่า roleDefault ดิบไว้เทียบ/รีเซ็ตกลับ
// (ต้องมีค่านี้แยกจาก effective เพราะตอน override อยู่ effective จะไม่ใช่ค่า default อีกต่อไป)
// superadminLocked = override นี้ superadmin ตั้งไว้ แอดมินของโรงพยาบาลแก้ทับไม่ได้
export async function getEffectivePermissions(userId, role) {
  if (role === 'SUPERADMIN') {
    return PERMISSION_CATALOG.map((p) => ({
      ...p,
      effective: true,
      roleDefault: true,
      source: 'superadmin',
      superadminLocked: false,
    }));
  }

  const [overrideRows] = await pool.query(
    'SELECT perm_key, effect, superadmin_locked FROM user_permission_overrides WHERE user_id = ?',
    [userId]
  );
  const overrideMap = new Map(overrideRows.map((r) => [r.perm_key, r]));

  const [defaultRows] = await pool.query(
    'SELECT perm_key FROM role_default_permissions WHERE role = ?',
    [role]
  );
  const defaultSet = new Set(defaultRows.map((r) => r.perm_key));

  return PERMISSION_CATALOG.map((p) => {
    const roleDefault = defaultSet.has(p.key);
    const override = overrideMap.get(p.key);
    if (override) {
      return {
        ...p,
        effective: override.effect === 'GRANT',
        roleDefault,
        source: 'override',
        superadminLocked: !!override.superadmin_locked,
      };
    }
    return { ...p, effective: roleDefault, roleDefault, source: 'default', superadminLocked: false };
  });
}

export async function incrementPermVersion(userId) {
  await pool.query('UPDATE users SET perm_version = perm_version + 1 WHERE id = ?', [userId]);
}

export async function getPermVersion(userId) {
  const [rows] = await pool.query('SELECT perm_version FROM users WHERE id = ?', [userId]);
  return rows[0]?.perm_version ?? 1;
}
