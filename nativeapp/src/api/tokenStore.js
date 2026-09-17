import * as SecureStore from 'expo-secure-store';

// Mirrors dashboard/src/auth/context/jwt (sessionStorage on web) but persisted in
// the OS keychain/keystore via SecureStore, since native has no cookie jar and the
// login response returns refreshToken in the body specifically for mobile clients
// (see server/src/controllers/auth.controller.js).

const ACCESS_TOKEN_KEY = 'welgroup_access_token';
const REFRESH_TOKEN_KEY = 'welgroup_refresh_token';
// ISO timestamp ของเวลาที่ "เซสชัน" (เพดานรวม 8 ชม. นับจาก login ครั้งแรก ไม่ใช่อายุ token แต่ละใบ)
// จะหมดอายุจริง — server เป็นคนคำนวณเสมอ (ดู server/src/controllers/auth.controller.js
// #sessionExpiresAtOf) มิเรอร์ค่าเดียวกับ dashboard/src/auth/context/jwt/constant.js ฝั่งเว็บ
const SESSION_EXPIRES_AT_KEY = 'welgroup_session_expires_at';

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getSessionExpiresAt() {
  return SecureStore.getItemAsync(SESSION_EXPIRES_AT_KEY);
}

export async function setSessionExpiresAt(sessionExpiresAt) {
  if (sessionExpiresAt) {
    await SecureStore.setItemAsync(SESSION_EXPIRES_AT_KEY, sessionExpiresAt);
  } else {
    await SecureStore.deleteItemAsync(SESSION_EXPIRES_AT_KEY);
  }
}

export async function setTokens({ accessToken, refreshToken }) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_EXPIRES_AT_KEY);
}
