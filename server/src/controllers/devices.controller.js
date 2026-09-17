import { pool } from '../db/pool.js';
import { getIO } from '../sockets/ioInstance.js';
import { AppError } from '../utils/AppError.js';
import { resolveTenantId, assertTenantAccess } from '../utils/tenant.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getGlobalSettings } from '../utils/globalSettings.js';
import { hashToken, generateDeviceToken } from '../utils/tokens.js';

function emitToHospital(hospitalId, event, payload) {
  const io = getIO();
  if (io) io.to(`hospital:${hospitalId}`).emit(event, payload);
}

// จุดสแกนหน้างาน -> ประเภทอุปกรณ์ที่เป็น default ของจุดนั้นได้ (ดู device.schema.js / device-constants.js)
const SCAN_POINT_DEVICE_TYPE = {
  WASH_RECEIVE: 'WEIGHT_GATE',
  STOCK_SCAN: 'RFID_CHECKPOINT',
  FABRIC_REGISTER: 'RFID_CHECKPOINT',
  FABRIC_REGISTER_HANDHELD: 'HANDHELD',
};

// 1 เครื่องตั้งเป็น default ได้หลายจุด แต่ 1 จุด = default ได้ 1 เครื่องต่อโรงพยาบาล —
// ตั้งจุดให้เครื่องใหม่ = ถอดจุดนั้นออกจากเครื่องอื่นในโรงพยาบาลเดียวกันก่อน
async function assertAndClearScanPoints(hospitalId, scanPoints, deviceType, excludeDeviceId = null) {
  const bad = scanPoints.find((point) => SCAN_POINT_DEVICE_TYPE[point] !== deviceType);
  if (bad) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'ประเภทอุปกรณ์ไม่ตรงกับจุดสแกนที่เลือกเป็นค่าเริ่มต้น'
    );
  }
  if (!scanPoints.length) return;

  const [rows] = await pool.query(
    `SELECT id, default_scan_points FROM devices
     WHERE hospital_id = ? AND deleted_at IS NULL AND default_scan_points IS NOT NULL`,
    [hospitalId]
  );

  for (const row of rows) {
    if (excludeDeviceId && row.id === excludeDeviceId) continue;
    // mysql2 parse JSON column เป็น array ให้แล้ว — เผื่อกรณีคืนมาเป็น string ก็ยัง parse ซ้ำได้
    const current = Array.isArray(row.default_scan_points)
      ? row.default_scan_points
      : JSON.parse(row.default_scan_points || '[]');
    const kept = current.filter((point) => !scanPoints.includes(point));
    if (kept.length !== current.length) {
      // eslint-disable-next-line no-await-in-loop
      await pool.query('UPDATE devices SET default_scan_points = ? WHERE id = ?', [
        kept.length ? JSON.stringify(kept) : null,
        row.id,
      ]);
    }
  }
}

/**
 * GET /api/v1/devices
 */
export const listDevices = asyncHandler(async (req, res) => {
  const tenantId = await resolveTenantId(req);
  const where = { deleted_at: null };
  if (req.query.deviceType) where.device_type = req.query.deviceType;

  const devices = await scopedQuery(pool, tenantId).select('devices', where);
  return res.json({ devices });
});

/**
 * POST /api/v1/devices — ต้องมีสิทธิ์ web.devices.edit (route ก็กันชั้นนึงแล้ว — กันซ้ำ defense in depth)
 */
export const createDevice = asyncHandler(async (req, res) => {
  if (!(await hasPermission(req.auth.userId, req.auth.role, 'web.devices.edit'))) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์เพิ่มอุปกรณ์ กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์');
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  const {
    deviceType,
    caretakerName,
    caretakerPhone,
    rssiThresholdDbm,
    targetBundleSize,
    ipAddress,
    port,
    scanProfile,
    scanPowerDbm,
    defaultScanPoints,
  } = req.body;

  const scanPoints = defaultScanPoints ?? [];
  if (scanPoints.length) {
    await assertAndClearScanPoints(tenantId, scanPoints, deviceType);
  }

  // ไม่ระบุ rssiThresholdDbm มา -> fallback ไปใช้ค่ามาตรฐานกลางที่ superadmin ตั้งไว้
  // (Global System Config) ดู server/src/controllers/globalSettings.controller.js
  const globalSettings = await getGlobalSettings();

  // ออก device token ให้ตั้งแต่สร้าง — ต้องนำไปตั้งค่าใน edge agent เพื่อยิง /heartbeat ได้
  // เก็บแค่ hash ไว้ ตัว plaintext ส่งกลับให้เห็นครั้งเดียวตอนนี้เท่านั้น (เหมือน API key ทั่วไป)
  const deviceToken = generateDeviceToken();

  const result = await scopedQuery(pool, tenantId).insert('devices', {
    device_type: deviceType,
    caretaker_name: caretakerName ?? null,
    caretaker_phone: caretakerPhone ?? null,
    rssi_threshold_dbm: rssiThresholdDbm ?? globalSettings.default_rssi_threshold_dbm,
    target_bundle_size: targetBundleSize ?? null,
    ip_address: ipAddress ?? null,
    port: port ?? null,
    scan_profile: scanProfile ?? 'NORMAL',
    scan_power_dbm: scanPowerDbm ?? null,
    default_scan_points: scanPoints.length ? JSON.stringify(scanPoints) : null,
    device_token_hash: hashToken(deviceToken),
    status: 'OFFLINE',
  });

  return res.status(201).json({ id: result.insertId, deviceType, deviceToken });
});

/**
 * POST /api/v1/devices/:id/rotate-token — ต้องมีสิทธิ์ web.devices.edit ออก device token ใหม่แทนของเดิม
 * (ของเดิมใช้ไม่ได้ทันที) เผื่อ token หลุด/ทำหาย
 */
export const rotateDeviceToken = asyncHandler(async (req, res) => {
  if (!(await hasPermission(req.auth.userId, req.auth.role, 'web.devices.edit'))) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์รีเซ็ต device token กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์');
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  await assertTenantAccess(req, device.hospital_id);

  const deviceToken = generateDeviceToken();
  await pool.query('UPDATE devices SET device_token_hash = ? WHERE id = ?', [
    hashToken(deviceToken),
    req.params.id,
  ]);

  return res.json({ deviceToken });
});

/**
 * POST /api/v1/devices/:id/heartbeat — device token เท่านั้น (ไม่ใช่ user JWT)
 * Edge device ยิงทุก 30 วิ ตาม docs/device-network-failure-handling.md หัวข้อ 1
 * ถ้าเพิ่งกลับมาจาก OFFLINE ให้ log การเปลี่ยนสถานะ + แจ้ง dashboard ผ่าน Socket.io ทันที
 */
export const receiveHeartbeat = asyncHandler(async (req, res) => {
  // :id ใน URL แค่ช่วยอ่าน log ง่าย ไม่ใช่ตัวตัดสิน — ยึด req.device.id จาก token เป็นหลักเสมอ
  // เผื่อ edge device ตั้งค่า URL ผิดตัว (เช่น deploy สลับเครื่อง) ยังกันได้ตรงนี้
  if (Number(req.params.id) !== req.device.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'device token ไม่ตรงกับ device id ใน URL');
  }

  const [current] = await pool.query('SELECT status, hospital_id FROM devices WHERE id = ?', [
    req.device.id,
  ]);
  const wasOffline = current[0]?.status === 'OFFLINE';

  await pool.query(
    'UPDATE devices SET last_heartbeat_at = NOW(), status = ? WHERE id = ?',
    ['ONLINE', req.device.id]
  );

  if (wasOffline) {
    await pool.query(
      'INSERT INTO device_status_log (device_id, status) VALUES (?, ?)',
      [req.device.id, 'ONLINE']
    );
    emitToHospital(req.device.hospitalId, 'device:status_changed', {
      deviceId: req.device.id,
      status: 'ONLINE',
    });
  }

  return res.status(204).send();
});

/**
 * PATCH /api/v1/devices/:id
 *  - มีสิทธิ์ web.devices.edit: แก้ได้ทุกอย่าง (ประเภท, ผู้ดูแล, RSSI, จำนวนต่อมัด, IP/Port)
 *  - มีแค่ web.devices.caretaker.edit: แก้ได้เฉพาะข้อมูลผู้ดูแล — ส่งฟิลด์ config มาด้วยจะถูกปฏิเสธ
 * ฟิลด์ที่ส่งค่าว่าง/null มา = สั่งล้างค่านั้น (เช่น ลบ IP/Port ออก)
 */
export const updateDevice = asyncHandler(async (req, res) => {
  const canEditConfig = await hasPermission(req.auth.userId, req.auth.role, 'web.devices.edit');

  const configKeys = [
    'deviceType',
    'rssiThresholdDbm',
    'targetBundleSize',
    'ipAddress',
    'port',
    'scanProfile',
    'scanPowerDbm',
    'defaultScanPoints',
  ];

  if (!canEditConfig) {
    const allowed = await hasPermission(
      req.auth.userId,
      req.auth.role,
      'web.devices.caretaker.edit'
    );
    if (!allowed) {
      throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์แก้ไขข้อมูลผู้ดูแลอุปกรณ์ กรุณาติดต่อ admin ให้เปิดสิทธิ์');
    }
    if (configKeys.some((key) => req.body[key] !== undefined)) {
      throw new AppError(403, 'FORBIDDEN', 'สิทธิ์นี้แก้ไขได้เฉพาะข้อมูลผู้ดูแลอุปกรณ์ ไม่รวมประเภท/RSSI/เครือข่าย');
    }
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  await assertTenantAccess(req, device.hospital_id);

  const {
    caretakerName,
    caretakerPhone,
    deviceType,
    rssiThresholdDbm,
    targetBundleSize,
    ipAddress,
    port,
    scanProfile,
    scanPowerDbm,
    defaultScanPoints,
  } = req.body;

  const updates = {};
  if (caretakerName !== undefined) updates.caretaker_name = caretakerName || null;
  if (caretakerPhone !== undefined) updates.caretaker_phone = caretakerPhone || null;
  if (canEditConfig) {
    if (deviceType !== undefined) updates.device_type = deviceType;
    if (rssiThresholdDbm !== undefined) updates.rssi_threshold_dbm = rssiThresholdDbm;
    if (targetBundleSize !== undefined) updates.target_bundle_size = targetBundleSize ?? null;
    if (ipAddress !== undefined) updates.ip_address = ipAddress || null;
    if (port !== undefined) updates.port = port ?? null;
    if (scanProfile !== undefined) updates.scan_profile = scanProfile;
    if (scanPowerDbm !== undefined) updates.scan_power_dbm = scanPowerDbm ?? null;
    if (defaultScanPoints !== undefined) {
      const points = defaultScanPoints ?? [];
      const targetType = deviceType !== undefined ? deviceType : device.device_type;
      if (points.length) {
        await assertAndClearScanPoints(device.hospital_id, points, targetType, device.id);
      }
      updates.default_scan_points = points.length ? JSON.stringify(points) : null;
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'ไม่มีข้อมูลให้อัปเดต');
  }

  await pool.query('UPDATE devices SET ? WHERE id = ?', [updates, req.params.id]);

  return res.status(204).send();
});

/**
 * DELETE /api/v1/devices/:id — ต้องมีสิทธิ์ web.devices.edit
 * soft delete (devices มี FK จาก scan_logs / device_status_log ฯลฯ ลบจริงไม่ได้ถ้ามีประวัติ)
 * อุปกรณ์ที่ลบแล้วจะหายจากทุกรายการ แต่ประวัติสแกนเดิมยังอยู่
 */
export const deleteDevice = asyncHandler(async (req, res) => {
  if (!(await hasPermission(req.auth.userId, req.auth.role, 'web.devices.edit'))) {
    throw new AppError(403, 'FORBIDDEN', 'ไม่มีสิทธิ์ลบอุปกรณ์ กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์');
  }

  const [rows] = await pool.query('SELECT * FROM devices WHERE id = ? AND deleted_at IS NULL', [
    req.params.id,
  ]);
  const device = rows[0];
  if (!device) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบอุปกรณ์นี้');
  }
  await assertTenantAccess(req, device.hospital_id);

  // ปล่อยจุด default ที่เครื่องนี้ถืออยู่ ไม่งั้นตั้งเครื่องอื่นเป็น default ของจุดเดิมแล้วชน unique key
  await pool.query(
    'UPDATE devices SET deleted_at = NOW(), default_scan_points = NULL WHERE id = ?',
    [req.params.id]
  );

  return res.status(204).send();
});
