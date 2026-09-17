'use client';

import { mutate } from 'swr';

import axios, { endpoints } from 'src/utils/axios';
import { disconnectSocket } from 'src/utils/socket';

import { JUST_LOGGED_IN_KEY } from './constant';
import { setSession, setSessionExpiresAt } from './utils';

// ล้าง SWR cache ทั้งหมด — สิทธิ์/โรงพยาบาล/รายการต่างๆ ผูกกับ user ที่ล็อกอินอยู่ ถ้าไม่ล้าง
// ตอนสลับบัญชีใน tab เดิม (SPA ไม่ full reload) SWR จะเสิร์ฟ cache ของ user คนก่อน
// (useGetMyPermissions ตั้ง revalidateIfStale:false -> ไม่ยิงใหม่ตอน mount ถ้ามี cache)
async function clearSwrCache() {
  await mutate(() => true, undefined, { revalidate: false });
}

/** **************************************
 * Sign in
 *************************************** */
export const signInWithPassword = async ({ username, password }) => {
  try {
    const params = { username, password };

    const res = await axios.post(endpoints.auth.signIn, params);

    const { accessToken, sessionExpiresAt } = res.data;

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    setSession(accessToken);
    setSessionExpiresAt(sessionExpiresAt);
    sessionStorage.setItem(JUST_LOGGED_IN_KEY, '1');
    await clearSwrCache();
  } catch (error) {
    console.error('Error during sign in:', error);
    throw error;
  }
};

/** **************************************
 * Sign up
 * ระบบนี้ไม่มี self sign-up สาธารณะ — บัญชีถูกสร้างโดย superadmin/admin เท่านั้น
 * ตาม docs/rbac-permissions.md (cascading delegation)
 *************************************** */
export const signUp = async () => {
  throw new Error('Self sign-up ไม่รองรับในระบบนี้ กรุณาติดต่อผู้ดูแลระบบเพื่อสร้างบัญชี');
};

/** **************************************
 * Sign out
 *************************************** */
export const signOut = async () => {
  try {
    await axios.post(endpoints.auth.logout); // revoke refresh token ฝั่ง server ด้วย ไม่ใช่แค่เคลียร์ token ฝั่ง client
  } catch (error) {
    console.error('Error revoking refresh token on server:', error);
  } finally {
    disconnectSocket();
    await setSession(null);
    await clearSwrCache();
  }
};
