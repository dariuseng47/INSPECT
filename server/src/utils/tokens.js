import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

// Access Token: อายุสั้น (15 นาที default) แนบผ่าน Authorization: Bearer
// session_started_at (unix seconds) = เวลา login ครั้งแรกของ "เซสชัน" นี้ ไม่เปลี่ยนตาม refresh
// ที่ตามมา — ใช้บังคับเพดานอายุเซสชันรวม (SESSION_MAX_TTL_HOURS) แยกจากอายุ token แต่ละใบ
// ดู authenticate.js middleware และ auth.controller.js#refresh
export function signAccessToken({ userId, role, hospitalId, permVersion, sessionStartedAt }) {
  return jwt.sign(
    {
      sub: String(userId),
      role,
      hospital_id: hospitalId ?? null,
      perm_version: permVersion,
      session_started_at: sessionStartedAt,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

// Refresh Token: อายุยาว (7 วัน default) + track ใน DB (refresh_tokens) เพื่อ whitelist/rotate/revoke ได้
// session_started_at ต้องถูก "สืบทอด" มาจาก token เดิมทุกครั้งที่ rotate (ดู issueTokenPair ใน
// auth.controller.js) ห้าม reset เป็นเวลาปัจจุบัน ไม่งั้นเพดาน 8 ชม. จะไม่มีผลตราบใดที่ยัง active ต่อเนื่อง
export function signRefreshToken({ userId, sessionStartedAt }) {
  return jwt.sign(
    { sub: String(userId), session_started_at: sessionStartedAt },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL }
  );
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

// เก็บ hash ของ refresh token ลง DB แทนตัวจริง (กันกรณี DB รั่วแล้วใช้ token เดิม replay ได้ทันที)
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Device token: opaque random string (ไม่ใช่ JWT) ให้ edge device ใช้ยิง POST /devices/:id/heartbeat
// เห็น plaintext ได้ครั้งเดียวตอนออก/รีเซ็ต — เก็บแค่ hash ไว้เทียบ (ดู authenticateDevice.js)
export function generateDeviceToken() {
  return crypto.randomBytes(32).toString('hex');
}
