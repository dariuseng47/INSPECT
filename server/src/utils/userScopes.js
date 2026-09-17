import { pool } from '../db/pool.js';
import { AppError } from './AppError.js';

// helper รวมสำหรับจัดการ user_hospital_scopes (แอดมิน/พนักงาน ดูแลได้หลายโรงพยาบาล)
// ดู docs/rbac-permissions.md + docs/multi-tenant-isolation.md

export async function getUserScopeRows(userId) {
  const [rows] = await pool.query(
    'SELECT hospital_id, can_edit FROM user_hospital_scopes WHERE user_id = ? ORDER BY hospital_id',
    [userId]
  );
  return rows.map((r) => ({ hospitalId: Number(r.hospital_id), canEdit: !!r.can_edit }));
}

// รับ input จาก body — รองรับทั้งรูปแบบใหม่ (hospitalScopes[]) และเก่า (hospitalId เดี่ยว)
// คืน [{ hospitalId, canEdit }] ที่ dedupe แล้ว (ค่าซ้ำ hospitalId ตัวหลังชนะ)
export function normalizeScopeInput(body) {
  if (Array.isArray(body.hospitalScopes)) {
    const map = new Map();
    for (const s of body.hospitalScopes) {
      const hid = Number(s.hospitalId);
      if (!Number.isInteger(hid) || hid <= 0) continue;
      map.set(hid, { hospitalId: hid, canEdit: s.canEdit !== false });
    }
    return [...map.values()];
  }
  if (body.hospitalId) {
    return [{ hospitalId: Number(body.hospitalId), canEdit: true }];
  }
  return [];
}

// แอดมินมอบ scope ให้พนักงานได้ไม่เกิน scope ของตัวเอง และมอบ can_edit ได้เฉพาะโรงพยาบาลที่
// ตัวเอง can_edit อยู่แล้ว (superadmin ข้ามเช็คนี้)
export async function assertScopesWithinDelegator(delegatorAuth, scopes) {
  if (delegatorAuth.role === 'SUPERADMIN') return;

  const own = await getUserScopeRows(delegatorAuth.userId);
  const ownMap = new Map(own.map((s) => [s.hospitalId, s]));

  for (const s of scopes) {
    const ownScope = ownMap.get(s.hospitalId);
    if (!ownScope) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'มอบสิทธิ์เข้าถึงโรงพยาบาลที่ตัวคุณเองไม่มีสิทธิ์ไม่ได้'
      );
    }
    if (s.canEdit && !ownScope.canEdit) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'มอบสิทธิ์ "แก้ไข" ในโรงพยาบาลที่ตัวคุณเองมีสิทธิ์ดูอย่างเดียวไม่ได้'
      );
    }
  }
}

// เขียนทับ scope ทั้งชุดของ user (delete + insert) — ใช้ connection เดียวแบบ transaction ย่อๆ
export async function replaceUserScopes(userId, scopes, grantedBy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_hospital_scopes WHERE user_id = ?', [userId]);
    for (const s of scopes) {
      // eslint-disable-next-line no-await-in-loop
      await conn.query(
        `INSERT INTO user_hospital_scopes (user_id, hospital_id, can_edit, granted_by)
         VALUES (?, ?, ?, ?)`,
        [userId, s.hospitalId, s.canEdit ? 1 : 0, grantedBy ?? null]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// primary hospital_id ที่จะเก็บลง users.hospital_id (ยังใช้เป็น fallback/ค่าเริ่มต้นอยู่)
// = โรงพยาบาลแรกใน scope (เรียงตาม id) หรือ null ถ้าไม่มี scope
export function primaryHospitalId(scopes, preferred) {
  if (!scopes.length) return null;
  if (preferred && scopes.some((s) => s.hospitalId === Number(preferred))) return Number(preferred);
  return scopes[0].hospitalId;
}
