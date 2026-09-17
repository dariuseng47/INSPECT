import { pool } from '../db/pool.js';
import { AppError } from './AppError.js';

// ============================================================================
// Tenant resolution — ตั้งแต่ migration 028 การเข้าถึงระดับ tenant ของ "ทุก role" อิงจาก
// user_hospital_scopes (แอดมิน/พนักงาน ดูแลได้หลายโรงพยาบาล) ไม่ใช่ users.hospital_id เดี่ยว
// อีกต่อไป — ดู docs/multi-tenant-isolation.md
//
//   - superadmin           : ไม่มี scope (เข้าได้ทุกโรงพยาบาล) ต้องระบุโรงพยาบาลมา explicit เสมอ
//   - admin/operator        : เข้าได้เฉพาะโรงพยาบาลใน scope ของตัวเอง; write ต้องมี can_edit ด้วย
//   - บัญชีเก่า (ยังไม่มี scope): fallback ไปใช้ req.auth.hospitalId จาก JWT (backward compat
//     จนกว่าจะถูกตั้ง scope ครั้งแรก — backfill ใน 028 ทำให้บัญชีที่มี hospital_id อยู่แล้วมี scope)
//
// โรงพยาบาลที่ client เลือกทำงานอยู่มาทาง ?hospitalId= (เว็บ) หรือ header x-hospital-id (nativeapp)
// ============================================================================

// cache scope rows ไว้บน req — resolveTenantId/assertHospitalEditable อาจถูกเรียกหลายรอบต่อ request
async function loadScopeRows(req) {
  if (req._hospitalScopes) return req._hospitalScopes;
  const [rows] = await pool.query(
    'SELECT hospital_id, can_edit FROM user_hospital_scopes WHERE user_id = ?',
    [req.auth.userId]
  );
  req._hospitalScopes = rows.map((r) => ({
    hospitalId: Number(r.hospital_id),
    canEdit: !!r.can_edit,
  }));
  return req._hospitalScopes;
}

function requestedHospitalId(req) {
  const raw = req.query?.hospitalId ?? req.headers?.['x-hospital-id'];
  if (raw === undefined || raw === null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export async function resolveTenantId(req) {
  const requested = requestedHospitalId(req);

  if (req.auth.role === 'SUPERADMIN') {
    if (!requested) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ ?hospitalId= เสมอ');
    }
    return requested;
  }

  const scopes = await loadScopeRows(req);

  // บัญชีเก่าที่ยังไม่มี scope — ใช้ hospital_id จาก JWT (เดิม)
  if (scopes.length === 0) {
    if (!req.auth.hospitalId) {
      throw new AppError(403, 'FORBIDDEN', 'บัญชีนี้ยังไม่ได้ผูกกับโรงพยาบาลใด กรุณาติดต่อผู้ดูแลระบบ');
    }
    if (requested && requested !== req.auth.hospitalId) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงข้อมูลของโรงพยาบาลนี้');
    }
    return req.auth.hospitalId;
  }

  const scopeIds = scopes.map((s) => s.hospitalId);

  if (!requested) {
    // ไม่ได้ระบุมา — ใช้ primary (hospital_id จาก JWT ถ้าอยู่ใน scope) ไม่งั้นโรงพยาบาลแรกใน scope
    if (req.auth.hospitalId && scopeIds.includes(req.auth.hospitalId)) {
      return req.auth.hospitalId;
    }
    return scopeIds[0];
  }

  if (!scopeIds.includes(requested)) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงข้อมูลของโรงพยาบาลนี้');
  }
  return requested;
}

// เรียกก่อนดำเนินการ write ใดๆ — โรงพยาบาลนั้นต้องอยู่ใน scope แบบ can_edit (superadmin ผ่านเสมอ)
export async function assertHospitalEditable(req, hospitalId) {
  if (req.auth.role === 'SUPERADMIN') return;

  const scopes = await loadScopeRows(req);
  if (scopes.length === 0) return; // บัญชีเก่า — พฤติกรรมเดิม (แก้ได้)

  const scope = scopes.find((s) => s.hospitalId === Number(hospitalId));
  if (!scope) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึงข้อมูลของโรงพยาบาลนี้');
  }
  if (!scope.canEdit) {
    throw new AppError(403, 'FORBIDDEN', 'บัญชีนี้มีสิทธิ์ดูอย่างเดียวในโรงพยาบาลนี้ แก้ไขไม่ได้');
  }
}

// โรงพยาบาลนั้นอยู่ใน scope ของ user ไหม (ไม่สนใจ can_edit) — ใช้แทน pattern เดิม
//   req.auth.role !== 'SUPERADMIN' && resource.hospital_id !== req.auth.hospitalId
// ที่ controller เขียนไว้เอง ให้รองรับแอดมินหลายโรงพยาบาล
export async function assertTenantAccess(req, hospitalId) {
  if (req.auth.role === 'SUPERADMIN') return;

  const scopes = await loadScopeRows(req);
  if (scopes.length === 0) {
    if (Number(hospitalId) !== req.auth.hospitalId) {
      throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลที่ต้องการ');
    }
    return;
  }

  if (!scopes.some((s) => s.hospitalId === Number(hospitalId))) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบข้อมูลที่ต้องการ');
  }
}

// รายชื่อโรงพยาบาลที่ user เข้าถึงได้ + ธง canEdit ต่อแห่ง — ใช้โดย GET /users/me/hospitals
// และแนบไปกับ payload ตอน login/me เพื่อให้ตัวสลับโรงพยาบาลฝั่ง client แสดงได้ทันที
export async function listAccessibleHospitals(req) {
  return listAccessibleHospitalsFor(req.auth);
}

// เวอร์ชันที่รับ auth-shape ตรงๆ ({ userId, role, hospitalId }) — ใช้ตอน login/login-pin
// ที่ยังไม่มี req.auth (session เพิ่งถูกสร้าง)
export async function listAccessibleHospitalsFor({ userId, role, hospitalId }) {
  if (role === 'SUPERADMIN') {
    const [rows] = await pool.query(
      'SELECT id, name FROM hospitals WHERE deleted_at IS NULL ORDER BY name'
    );
    return rows.map((h) => ({ id: h.id, name: h.name, canEdit: true }));
  }

  const [scopeRows] = await pool.query(
    'SELECT hospital_id, can_edit FROM user_hospital_scopes WHERE user_id = ?',
    [userId]
  );

  if (scopeRows.length === 0) {
    if (!hospitalId) return [];
    const [rows] = await pool.query(
      'SELECT id, name FROM hospitals WHERE id = ? AND deleted_at IS NULL',
      [hospitalId]
    );
    return rows.map((h) => ({ id: h.id, name: h.name, canEdit: true }));
  }

  const ids = scopeRows.map((s) => Number(s.hospital_id));
  const [rows] = await pool.query(
    `SELECT id, name FROM hospitals WHERE id IN (${ids.map(() => '?').join(',')}) AND deleted_at IS NULL ORDER BY name`,
    ids
  );
  const editMap = new Map(scopeRows.map((s) => [Number(s.hospital_id), !!s.can_edit]));
  return rows.map((h) => ({ id: h.id, name: h.name, canEdit: editMap.get(h.id) ?? false }));
}
