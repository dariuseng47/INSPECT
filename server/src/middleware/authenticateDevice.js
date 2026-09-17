import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { hashToken } from '../utils/tokens.js';

// Auth แยกจาก user JWT โดยสิ้นเชิง — edge device (Raspberry Pi) ไม่ใช่ user ไม่มี role/hospital
// context ของตัวเอง ใช้ device_token_hash หา device ตัวเองจาก token โดยตรง (unique ต่อเครื่องอยู่แล้ว
// ตอนออก/รีเซ็ต — ดู devices.controller.js) ไม่ผูกกับ :id ใน URL เพราะบาง endpoint เช่น
// /scans/weight-gate ไม่มี device id ใน path เลย ตัว controller ต้องใช้ req.device.id ที่ยืนยันแล้ว
// เป็น source of truth เสมอ ห้ามเชื่อ :id จาก URL แทน — ดู docs/device-network-failure-handling.md หัวข้อ 1
export async function authenticateDevice(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'ไม่พบ device token'));
  }

  const token = header.slice('Bearer '.length);
  const tokenHash = hashToken(token);

  try {
    const [rows] = await pool.query(
      'SELECT id, hospital_id, device_type FROM devices WHERE device_token_hash = ? LIMIT 1',
      [tokenHash]
    );
    if (!rows[0]) {
      return next(new AppError(401, 'UNAUTHORIZED', 'device token ไม่ถูกต้อง'));
    }

    req.device = {
      id: rows[0].id,
      hospitalId: rows[0].hospital_id,
      deviceType: rows[0].device_type,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}
