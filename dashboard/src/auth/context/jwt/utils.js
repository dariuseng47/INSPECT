import axios from 'src/utils/axios';

import { STORAGE_KEY, SESSION_EXPIRES_KEY } from './constant';

// ----------------------------------------------------------------------

export function jwtDecode(token) {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length < 2) {
      throw new Error('Invalid token!');
    }

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64));

    return decoded;
  } catch (error) {
    console.error('Error decoding token:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

export function isValidToken(accessToken) {
  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);

    if (!decoded || !('exp' in decoded)) {
      return false;
    }

    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime;
  } catch (error) {
    console.error('Error during token validation:', error);
    return false;
  }
}

// ----------------------------------------------------------------------

// หมายเหตุ: ไม่ hard-redirect ตอน access token หมดอายุ เพราะ axios interceptor (src/utils/axios.js)
// จะ silent-refresh ให้อัตโนมัติเมื่อเจอ 401 ใน request ถัดไปอยู่แล้ว ที่นี่แค่เคลียร์ token เก่าจาก storage
export function tokenExpired(exp) {
  const currentTime = Date.now();
  const timeLeft = exp * 1000 - currentTime;

  setTimeout(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, timeLeft);
}

// ----------------------------------------------------------------------

export async function setSession(accessToken) {
  try {
    if (accessToken) {
      sessionStorage.setItem(STORAGE_KEY, accessToken);

      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      const decodedToken = jwtDecode(accessToken); // access token อายุ 15 นาที (ดู server/.env ACCESS_TOKEN_TTL)

      if (decodedToken && 'exp' in decodedToken) {
        tokenExpired(decodedToken.exp);
      } else {
        throw new Error('Invalid access token!');
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_EXPIRES_KEY);
      delete axios.defaults.headers.common.Authorization;
    }
  } catch (error) {
    console.error('Error during set session:', error);
    throw error;
  }
}

// ----------------------------------------------------------------------

// เก็บ/อ่าน "เวลาที่เซสชันจะหมดอายุจริง" (ค่าจาก server เสมอ) ไว้แยกจาก access token — ให้
// SessionTimeoutWatcher อ่านค่าล่าสุดได้จากจุดเดียว ไม่ว่าค่าจะถูกอัปเดตมาจาก login, checkUserSession
// หรือ silent refresh ใน axios interceptor (src/utils/axios.js) ก็ตาม
export function setSessionExpiresAt(sessionExpiresAt) {
  if (sessionExpiresAt) {
    sessionStorage.setItem(SESSION_EXPIRES_KEY, sessionExpiresAt);
  } else {
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
  }
}

export function getSessionExpiresAt() {
  return sessionStorage.getItem(SESSION_EXPIRES_KEY);
}
