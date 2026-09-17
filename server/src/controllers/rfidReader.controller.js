import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { scopedQuery } from '../db/scopedQuery.js';
import { hasPermission } from '../utils/permissions.js';
import { queryTags } from '../services/rfidReader.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// โปรไฟล์ความเร็วการสแกน (ตั้งได้ต่อเครื่องในหน้าอุปกรณ์ — คอลัมน์ devices.scan_profile)
// idleTimeoutMs = รอเงียบเท่านี้ = เครื่องตอบรอบนั้นจบ | stableRounds = ไม่เจอ EPC ใหม่กี่รอบติดกันถึงจบ
const SCAN_PROFILES = {
  VERY_FAST: { idleTimeoutMs: 200, stableRounds: 1 },
  FAST: { idleTimeoutMs: 400, stableRounds: 2 },
  NORMAL: { idleTimeoutMs: 800, stableRounds: 3 },
  THOROUGH: { idleTimeoutMs: 1200, stableRounds: 5 },
};

/**
 * POST /api/v1/rfid-reader/scan — admin ของโรงพยาบาล หรือ superadmin (มองข้าม tenant ได้ ต้องระบุ
 * hospitalId มาเองเสมอ ตามแพทเทิร์น resolveTenantId ดู docs/multi-tenant-isolation.md ชั้นที่ 1)
 * สั่งเครื่องอ่าน RFID ที่จุดตรวจสอบให้ inventory 1 รอบแล้วคืนรายการ EPC ที่อ่านได้กลับมาทันที
 * (synchronous — ไม่ผ่าน scan session แบบ handheld เพราะเครื่องนี้ต่อ LAN สั่งงานได้ตรงจาก server เลย
 * ไม่ต้องรอ device ยิง callback กลับมาเอง)
 *
 * หมายเหตุ: การ "สแกน" (endpoint นี้) ผูกกับสิทธิ์เมนู "อุปกรณ์ & สัญญาณ RFID" (web.devices.view)
 * ไม่ผูกกับ role แล้ว — operator ที่ admin เปิดสิทธิ์นี้ให้ก็สั่งเครื่องอ่านได้ (เช่น หน้า รับผ้าหลังซัก
 * / สแกนเข้าสต๊อค) ส่วนขั้นตอนถัดไป (ยืนยันเพิ่มผ้าเข้าระบบผ่าน /fabric-items/bulk) ยังเป็นสิทธิ์
 * admin โรงพยาบาลเท่านั้นตามเดิม
 */
export const scanCheckpoint = asyncHandler(async (req, res) => {
  if (!(await hasPermission(req.auth.userId, req.auth.role, 'web.devices.view'))) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'ไม่มีสิทธิ์สั่งเครื่องอ่าน RFID กรุณาติดต่อผู้ดูแลระบบให้เปิดสิทธิ์ "อุปกรณ์ & สัญญาณ RFID"'
    );
  }

  let tenantId = req.auth.hospitalId;
  if (req.auth.role === 'SUPERADMIN') {
    tenantId = req.body.hospitalId;
    if (!tenantId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'superadmin ต้องระบุ hospitalId เสมอ');
    }
  }

  // server ต่อ TCP เข้าไปอ่านแท็กเองได้ทั้งเครื่องจุดตรวจสอบ และเครื่องที่ประตูชั่งน้ำหนัก
  // (ทั้งคู่ต่อ LAN + ตั้ง IP/Port ไว้) — ต่างกันแค่บทบาทในระบบ
  const SERVER_PULL_TYPES = ['RFID_CHECKPOINT', 'WEIGHT_GATE'];
  const devices = await scopedQuery(pool, tenantId).select('devices', {
    id: req.body.deviceId,
    deleted_at: null,
  });
  const device = devices[0];
  if (!device || !SERVER_PULL_TYPES.includes(device.device_type)) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบเครื่องอ่าน RFID นี้ (ต้องเป็นจุดตรวจสอบ หรือประตูชั่งน้ำหนัก)');
  }
  if (!device.ip_address || !device.port) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'อุปกรณ์นี้ยังไม่ได้ตั้งค่า IP/Port — แก้ไขได้ที่หน้าอุปกรณ์ & สัญญาณ RFID'
    );
  }

  let result;
  try {
    const profile = SCAN_PROFILES[device.scan_profile] || SCAN_PROFILES.NORMAL;
    result = await queryTags({
      ip: device.ip_address,
      port: device.port,
      ...profile,
      // null = ไม่แตะ ใช้ค่ากำลังส่งที่ตั้งไว้ในตัวเครื่องเดิม
      powerDbm: device.scan_power_dbm ?? undefined,
    });
  } catch (error) {
    throw new AppError(502, 'READER_UNREACHABLE', `เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ: ${error.message}`);
  }

  return res.json({ epcs: result.epcs });
});
