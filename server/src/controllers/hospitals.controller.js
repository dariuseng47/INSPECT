import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// HQ Super Admin ยังไม่มีหน้า "จัดการ organizations" แยก (เป็น grouping เฉยๆ ตาม docs/data-model.md)
// จึงสร้าง default organization ให้อัตโนมัติแบบ idempotent เวลามีการสร้าง hospital ครั้งแรก
async function ensureDefaultOrganizationId() {
  const [rows] = await pool.query(
    "SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1"
  );
  if (rows[0]) return rows[0].id;

  const [result] = await pool.query('INSERT INTO organizations (name) VALUES (?)', [
    'Default Organization',
  ]);
  return result.insertId;
}

/**
 * GET /api/v1/hospitals — superadmin เท่านั้น
 */
export const listHospitals = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.id, h.name, h.quota_config, h.created_at,
            o.name AS organization_name
     FROM hospitals h
     JOIN organizations o ON o.id = h.organization_id
     WHERE h.deleted_at IS NULL
     ORDER BY h.created_at DESC`
  );
  return res.json({ hospitals: rows });
});

/**
 * POST /api/v1/hospitals — superadmin เท่านั้น (สร้าง tenant ใหม่)
 */
export const createHospital = asyncHandler(async (req, res) => {
  const { name, region } = req.body;

  const organizationId = await ensureDefaultOrganizationId();

  if (region) {
    await pool.query('UPDATE organizations SET region = ? WHERE id = ? AND region IS NULL', [
      region,
      organizationId,
    ]);
  }

  const [result] = await pool.query(
    'INSERT INTO hospitals (organization_id, name) VALUES (?, ?)',
    [organizationId, name]
  );

  await logAudit({
    hospitalId: result.insertId,
    userId: req.auth.userId,
    action: 'HOSPITAL_CREATED',
    entityType: 'hospital',
    entityId: result.insertId,
    metadata: { name },
  });

  return res.status(201).json({ id: result.insertId, name, organizationId });
});

/**
 * PATCH /api/v1/hospitals/:id — superadmin เท่านั้น
 */
export const updateHospital = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, quotaConfig } = req.body;

  const updates = [];
  const values = [];
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (quotaConfig !== undefined) {
    updates.push('quota_config = ?');
    values.push(JSON.stringify(quotaConfig));
  }

  if (updates.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  const [result] = await pool.query(
    `UPDATE hospitals SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...values, id]
  );

  if (result.affectedRows === 0) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบโรงพยาบาลนี้');
  }

  await logAudit({
    hospitalId: Number(id),
    userId: req.auth.userId,
    action: 'HOSPITAL_UPDATED',
    entityType: 'hospital',
    entityId: Number(id),
    metadata: { name, quotaConfig },
  });

  return res.status(204).send();
});

/**
 * GET /api/v1/hospitals/summary — superadmin เท่านั้น
 * สรุปข้อมูลรวมข้ามทุกโรงพยาบาลในครั้งเดียว (ใช้ทำ Super Dashboard) — query แบบ GROUP BY
 * ต่อ metric แทนการวน query ทีละโรงพยาบาล (N+1) เพื่อประสิทธิภาพที่ดีกว่าเมื่อจำนวน รพ. เพิ่มขึ้น
 */
export const getHospitalsSummary = asyncHandler(async (req, res) => {
  const [hospitals, fabricCounts, deviceCounts, userCounts] = await Promise.all([
    pool.query(
      `SELECT h.id, h.name, h.quota_config, h.created_at, o.name AS organization_name
       FROM hospitals h
       JOIN organizations o ON o.id = h.organization_id
       WHERE h.deleted_at IS NULL
       ORDER BY h.created_at DESC`
    ),
    pool.query(
      `SELECT hospital_id, COUNT(*) AS count FROM fabric_items
       WHERE deleted_at IS NULL GROUP BY hospital_id`
    ),
    pool.query(`SELECT hospital_id, status, COUNT(*) AS count FROM devices GROUP BY hospital_id, status`),
    pool.query(
      `SELECT hospital_id, COUNT(*) AS count FROM users
       WHERE deleted_at IS NULL AND hospital_id IS NOT NULL GROUP BY hospital_id`
    ),
  ]);

  const fabricByHospital = new Map(fabricCounts[0].map((r) => [r.hospital_id, r.count]));
  const userByHospital = new Map(userCounts[0].map((r) => [r.hospital_id, r.count]));
  const deviceByHospital = new Map();
  deviceCounts[0].forEach((r) => {
    const entry = deviceByHospital.get(r.hospital_id) ?? { online: 0, offline: 0 };
    if (r.status === 'ONLINE') entry.online = r.count;
    else entry.offline = r.count;
    deviceByHospital.set(r.hospital_id, entry);
  });

  const summary = hospitals[0].map((h) => ({
    id: h.id,
    name: h.name,
    organizationName: h.organization_name,
    createdAt: h.created_at,
    fabricCount: fabricByHospital.get(h.id) ?? 0,
    userCount: userByHospital.get(h.id) ?? 0,
    devicesOnline: deviceByHospital.get(h.id)?.online ?? 0,
    devicesOffline: deviceByHospital.get(h.id)?.offline ?? 0,
  }));

  const totals = summary.reduce(
    (acc, h) => ({
      hospitalCount: acc.hospitalCount + 1,
      fabricCount: acc.fabricCount + h.fabricCount,
      userCount: acc.userCount + h.userCount,
      devicesOnline: acc.devicesOnline + h.devicesOnline,
      devicesOffline: acc.devicesOffline + h.devicesOffline,
    }),
    { hospitalCount: 0, fabricCount: 0, userCount: 0, devicesOnline: 0, devicesOffline: 0 }
  );

  return res.json({ hospitals: summary, totals });
});

/**
 * DELETE /api/v1/hospitals/:id — superadmin เท่านั้น
 * บล็อกถ้ายังมีข้อมูลดำเนินงานอยู่ (ผู้ใช้/ผ้า/โครงสร้างแผนก) กันข้อมูลกำพร้าและกันลบพลาด
 * ของจริงในองค์กรที่ยังใช้งานอยู่ — ต้องย้าย/ปิดการใช้งานข้อมูลเหล่านั้นก่อนถึงจะลบ tenant ได้
 */
export const deleteHospital = asyncHandler(async (req, res) => {
  const hospitalId = Number(req.params.id);

  const [hospitalRows] = await pool.query(
    'SELECT id FROM hospitals WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [hospitalId]
  );
  if (!hospitalRows[0]) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบโรงพยาบาลนี้');
  }

  const [[users], [fabricItems], [departments]] = await Promise.all([
    pool.query('SELECT id FROM users WHERE hospital_id = ? AND deleted_at IS NULL LIMIT 1', [
      hospitalId,
    ]),
    pool.query('SELECT id FROM fabric_items WHERE hospital_id = ? AND deleted_at IS NULL LIMIT 1', [
      hospitalId,
    ]),
    pool.query('SELECT id FROM departments WHERE hospital_id = ? AND deleted_at IS NULL LIMIT 1', [
      hospitalId,
    ]),
  ]);

  if (users.length > 0) {
    throw new AppError(400, 'HAS_USERS', 'ลบไม่ได้ เพราะยังมีผู้ใช้งานอยู่ในโรงพยาบาลนี้');
  }
  if (fabricItems.length > 0) {
    throw new AppError(400, 'HAS_FABRIC', 'ลบไม่ได้ เพราะยังมีผ้าในระบบของโรงพยาบาลนี้');
  }
  if (departments.length > 0) {
    throw new AppError(400, 'HAS_DEPARTMENTS', 'ลบไม่ได้ เพราะยังมีโครงสร้างแผนกของโรงพยาบาลนี้');
  }

  await pool.query('UPDATE hospitals SET deleted_at = NOW() WHERE id = ?', [hospitalId]);

  await logAudit({
    hospitalId,
    userId: req.auth.userId,
    action: 'HOSPITAL_DELETED',
    entityType: 'hospital',
    entityId: hospitalId,
  });

  return res.status(204).send();
});

/**
 * GET /api/v1/hospitals/:id/dashboard-summary — superadmin (ทุก id) / admin & operator
 * (เฉพาะ tenant ตัวเอง — เข้าถึง endpoint นี้ได้ไหมเช็คที่ requirePermission('dashboard.hospital_profile.view')
 * middleware ไปแล้ว ที่เหลือแค่กัน cross-tenant)
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const hospitalId = Number(req.params.id);

  if (req.auth.role !== 'SUPERADMIN' && req.auth.hospitalId !== hospitalId) {
    throw new AppError(403, 'FORBIDDEN', 'เข้าถึงข้อมูลข้าม tenant ไม่ได้');
  }

  // audit ทุกครั้งที่ superadmin เข้าดูข้าม tenant — ดู docs/multi-tenant-isolation.md ชั้นที่ 5
  if (req.auth.role === 'SUPERADMIN') {
    await logAudit({
      hospitalId,
      userId: req.auth.userId,
      action: 'CROSS_TENANT_READ',
      entityType: 'hospital_dashboard_summary',
      entityId: hospitalId,
      metadata: { hospitalId },
    });
  }

  const [[fabricByStatus], [devicesByStatus], [todayScans], [stepSkipped]] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*) AS count FROM fabric_items
       WHERE hospital_id = ? AND deleted_at IS NULL GROUP BY status`,
      [hospitalId]
    ),
    pool.query(
      `SELECT status, COUNT(*) AS count FROM devices WHERE hospital_id = ? GROUP BY status`,
      [hospitalId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM scan_logs
       WHERE hospital_id = ? AND scanned_at >= CURDATE()`,
      [hospitalId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM scan_logs
       WHERE hospital_id = ? AND is_step_skipped = TRUE AND scanned_at >= (NOW() - INTERVAL 7 DAY)`,
      [hospitalId]
    ),
  ]);

  return res.json({
    fabricByStatus,
    devicesByStatus,
    todayScanCount: todayScans[0]?.count ?? 0,
    stepSkippedLast7Days: stepSkipped[0]?.count ?? 0,
  });
});
