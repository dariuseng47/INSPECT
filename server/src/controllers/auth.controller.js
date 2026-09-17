import bcrypt from 'bcryptjs';

import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { hashPin } from '../utils/pin.js';
import { AppError } from '../utils/AppError.js';
import { logAudit } from '../utils/auditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { listAccessibleHospitals, listAccessibleHospitalsFor } from '../utils/tenant.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/tokens.js';

// มือถือ (nativeapp ส่ง header x-client-type: mobile) จะ login ได้ต่อเมื่อ users.handheld_enabled = 1
// superadmin ข้ามเช็คนี้เสมอ — ดู docs/rbac-permissions.md (handheld master switch)
function assertHandheldAllowed(req, user) {
  const isMobile = req.headers['x-client-type'] === 'mobile';
  if (isMobile && user.role !== 'SUPERADMIN' && !user.handheld_enabled) {
    throw new AppError(
      403,
      'HANDHELD_DISABLED',
      'บัญชีนี้ไม่ได้รับอนุญาตให้ใช้งานเครื่องพกพา กรุณาติดต่อผู้ดูแลระบบ'
    );
  }
}

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 วัน

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: '/api/v1/auth',
  };
}

// sessionStartedAt: วินาที login ครั้งแรกของเซสชันนี้ — omit ตอนเรียกจาก login (เซสชันใหม่ ใช้เวลา
// ปัจจุบัน) ต้องส่งมาตอนเรียกจาก refresh() เพื่อสืบทอดต่อ ไม่ให้เพดาน 8 ชม. ถูก reset ทุกครั้งที่ refresh
async function issueTokenPair(user, sessionStartedAt = Math.floor(Date.now() / 1000)) {
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    hospitalId: user.hospital_id,
    // perm_version จริงจาก DB (เพิ่มขึ้นทุกครั้งที่ user_permission_overrides ของ user นี้ถูกแก้
    // — ดู server/src/utils/permissions.js incrementPermVersion) client เอาไว้เทียบกับค่า cache
    // เพื่อรู้ว่าต้อง refresh permission set ใหม่ กันใช้สิทธิ์เก่าค้างหลังโดนลดสิทธิ์กะทันหัน
    permVersion: user.perm_version,
    sessionStartedAt,
  });
  const refreshToken = signRefreshToken({ userId: user.id, sessionStartedAt });

  const decoded = verifyRefreshToken(refreshToken);
  const expiresAt = new Date(decoded.exp * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, hashToken(refreshToken), expiresAt]
  );

  return { accessToken, refreshToken, sessionStartedAt };
}

function sessionExpiresAtOf(sessionStartedAt) {
  return new Date(sessionStartedAt * 1000 + env.SESSION_MAX_TTL_HOURS * 60 * 60 * 1000);
}

function sanitizeUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * POST /api/v1/auth/login
 * หา user จาก username ระดับ global ก่อน (ยังไม่รู้ hospital_id ณ จุดนี้) จึง query ตรงผ่าน pool
 * ไม่ผ่าน scopedQuery เพราะขั้นตอนนี้คือการพิสูจน์ตัวตน ไม่ใช่การเข้าถึงข้อมูลระดับ tenant
 */
export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // LEFT JOIN hospitals — เผื่อ superadmin ที่ user.hospital_id เป็น NULL
  // เอาชื่อโรงพยาบาลติดมาด้วยเลยตั้งแต่ login เพื่อให้ sidebar switcher แสดงชื่อได้ทันที
  // โดยไม่ต้องมี endpoint แยก (admin/operator เรียก GET /hospitals ไม่ได้ เป็น superadmin เท่านั้น)
  const [rows] = await pool.query(
    `SELECT u.*, h.name AS hospital_name FROM users u
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.username = ? AND u.deleted_at IS NULL LIMIT 1`,
    [username]
  );
  const user = rows[0];

  if (!user || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  }

  assertHandheldAllowed(req, user);

  const { accessToken, refreshToken, sessionStartedAt } = await issueTokenPair(user);

  // ให้หน้า "ผู้ใช้งาน & สิทธิ์การเข้าถึง" โชว์ได้ว่าล่าสุดใคร login จากมือถือ (handheld) เมื่อไหร่
  // — ออนไลน์/ออฟไลน์แบบ real-time แยกอีกที่ (server/src/sockets/presence.js, ไม่ได้เก็บ DB)
  const loginClient = req.headers['x-client-type'] === 'mobile' ? 'mobile' : 'web';
  await pool.query('UPDATE users SET last_login_at = NOW(), last_login_client = ? WHERE id = ?', [
    loginClient,
    user.id,
  ]);

  await logAudit({
    hospitalId: user.hospital_id,
    userId: user.id,
    action: 'LOGIN',
    entityType: 'auth',
    entityId: user.id,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  return res.json({
    accessToken,
    refreshToken, // mobile client (Expo SecureStore) อ่านจากตรงนี้ ฝั่ง web ใช้ cookie แทน
    user: sanitizeUser(user),
    hospitals: await listAccessibleHospitalsFor({
      userId: user.id,
      role: user.role,
      hospitalId: user.hospital_id,
    }),
    sessionExpiresAt: sessionExpiresAtOf(sessionStartedAt),
  });
});

/**
 * POST /api/v1/auth/login-pin — ทางเลือกอีกช่องทางสำหรับ handheld แทน username/password
 * (ยังใช้ username/password ได้ตามปกติ ไม่ได้ตัดออก) — เก็บ pin_hash เป็น HMAC แบบ deterministic
 * (ดู server/src/utils/pin.js) จึง lookup ตรงได้ด้วย query เดียว ไม่ต้องรู้ username มาก่อน
 */
export const loginPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  const pinHash = hashPin(pin);

  const [rows] = await pool.query(
    `SELECT u.*, h.name AS hospital_name FROM users u
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.pin_hash = ? AND u.deleted_at IS NULL LIMIT 1`,
    [pinHash]
  );
  const user = rows[0];

  // ข้อความเดียวกับ INVALID_CREDENTIALS ของ login ปกติ — ไม่บอกว่า "ไม่พบ PIN นี้" เพื่อกัน
  // enumeration (ลองสุ่ม PIN ไล่ดูว่าอันไหนมีอยู่จริงในระบบ)
  if (!user || !user.is_active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'PIN ไม่ถูกต้อง');
  }

  assertHandheldAllowed(req, user);

  const { accessToken, refreshToken, sessionStartedAt } = await issueTokenPair(user);

  const loginClient = req.headers['x-client-type'] === 'mobile' ? 'mobile' : 'web';
  await pool.query('UPDATE users SET last_login_at = NOW(), last_login_client = ? WHERE id = ?', [
    loginClient,
    user.id,
  ]);

  await logAudit({
    hospitalId: user.hospital_id,
    userId: user.id,
    action: 'LOGIN_PIN',
    entityType: 'auth',
    entityId: user.id,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  return res.json({
    accessToken,
    refreshToken,
    user: sanitizeUser(user),
    hospitals: await listAccessibleHospitalsFor({
      userId: user.id,
      role: user.role,
      hospitalId: user.hospital_id,
    }),
    sessionExpiresAt: sessionExpiresAtOf(sessionStartedAt),
  });
});

/**
 * POST /api/v1/auth/refresh
 * รับ refresh token จาก cookie (web) หรือ body (mobile) แล้ว rotate ทันที (revoke ของเก่า, ออกใหม่)
 */
export const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (!incomingToken) {
    throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบ refresh token');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'refresh token ไม่ถูกต้องหรือหมดอายุ');
  }

  const tokenHash = hashToken(incomingToken);
  const [tokenRows] = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? LIMIT 1',
    [tokenHash, decoded.sub]
  );
  const tokenRecord = tokenRows[0];

  if (!tokenRecord || tokenRecord.revoked_at || new Date(tokenRecord.expires_at) < new Date()) {
    throw new AppError(401, 'UNAUTHORIZED', 'refresh token ถูกเพิกถอนหรือหมดอายุแล้ว');
  }

  const [userRows] = await pool.query(
    'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = TRUE LIMIT 1',
    [decoded.sub]
  );
  const user = userRows[0];
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'ไม่พบผู้ใช้งานนี้แล้ว');
  }

  // Rotation: เพิกถอน refresh token เก่าก่อนออกอันใหม่เสมอ (กัน replay)
  await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [
    tokenRecord.id,
  ]);

  // เพดานอายุเซสชันรวม (นับจาก login ครั้งแรก ไม่ใช่จาก refresh ล่าสุด) — ต่อให้ token ใบนี้ยังไม่หมดอายุ
  // และยัง active ต่อเนื่องมาตลอด ก็ต้อง login ใหม่เมื่อครบ SESSION_MAX_TTL_HOURS อยู่ดี token เก่า
  // (ก่อนมี claim นี้) จะไม่มี session_started_at — ปล่อยผ่านให้ issueTokenPair เริ่มนับเซสชันใหม่แทน
  if (decoded.session_started_at) {
    const sessionAgeMs = Date.now() - decoded.session_started_at * 1000;
    if (sessionAgeMs > env.SESSION_MAX_TTL_HOURS * 60 * 60 * 1000) {
      throw new AppError(
        401,
        'SESSION_EXPIRED',
        `เซสชันหมดอายุ (ครบ ${env.SESSION_MAX_TTL_HOURS} ชั่วโมงนับจากเข้าสู่ระบบ) กรุณาเข้าสู่ระบบใหม่`
      );
    }
  }

  const { accessToken, refreshToken, sessionStartedAt } = await issueTokenPair(
    user,
    decoded.session_started_at || undefined
  );

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());

  return res.json({
    accessToken,
    refreshToken,
    sessionExpiresAt: sessionExpiresAtOf(sessionStartedAt),
  });
});

/**
 * POST /api/v1/auth/logout
 * เพิกถอน refresh token ปัจจุบัน + เคลียร์ cookie
 */
export const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

  if (incomingToken) {
    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [
      hashToken(incomingToken),
    ]);
  }

  await logAudit({
    hospitalId: req.auth.hospitalId,
    userId: req.auth.userId,
    action: 'LOGOUT',
    entityType: 'auth',
    entityId: req.auth.userId,
  });

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
  return res.status(204).send();
});

/**
 * GET /api/v1/auth/me
 * ต้องผ่าน authenticate middleware มาก่อนแล้ว (req.auth พร้อมใช้)
 */
export const me = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.*, h.name AS hospital_name FROM users u
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
    [req.auth.userId]
  );
  const user = rows[0];

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'ไม่พบผู้ใช้งานนี้');
  }

  return res.json({
    user: sanitizeUser(user),
    hospitals: await listAccessibleHospitals(req),
    permVersion: req.auth.permVersion,
    sessionExpiresAt: req.auth.sessionStartedAt ? sessionExpiresAtOf(req.auth.sessionStartedAt) : null,
  });
});
