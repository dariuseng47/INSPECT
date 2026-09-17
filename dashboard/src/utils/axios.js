import axios from 'axios';

import { CONFIG } from 'src/config-global';

import { STORAGE_KEY, SESSION_EXPIRES_KEY } from 'src/auth/context/jwt/constant';

// ----------------------------------------------------------------------

export const endpoints = {
  auth: {
    me: '/auth/me',
    signIn: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  users: {
    list: '/users',
    details: (id) => `/users/${id}`,
    permissions: (id) => `/users/${id}/permissions`,
    myPermissions: '/users/me/permissions',
  },
  auditLogs: {
    list: '/audit-logs',
  },
  loginPopupImages: {
    list: '/login-popup-images',
    forMe: '/login-popup-images/for-me',
    details: (id) => `/login-popup-images/${id}`,
  },
};

// withCredentials: true — จำเป็นสำหรับส่ง HttpOnly refresh_token cookie ไปกับ /auth/refresh
const axiosInstance = axios.create({ baseURL: CONFIG.serverUrl, withCredentials: true });

// คิวรอ request อื่นที่โดน 401 พร้อมกันระหว่างกำลัง refresh อยู่ (กันยิง /auth/refresh ซ้ำซ้อน)
let isRefreshing = false;
let pendingQueue = [];

function resolvePendingQueue(error, accessToken) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(accessToken);
  });
  pendingQueue = [];
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthFlowEndpoint =
      originalRequest?.url === endpoints.auth.signIn || originalRequest?.url === endpoints.auth.refresh;

    // PERM_STALE = สิทธิ์ถูกแก้ (server/src/middleware/authenticate.js) -> หลัง refresh ต้องดึง
    // permission set ใหม่ เพื่อให้เมนู/ปุ่มอัปเดตตามทันที
    const isPermStale = error.response?.data?.error === 'PERM_STALE';

    // 401 นอก auth flow เอง -> ลอง refresh token แล้ว retry request เดิมอัตโนมัติ (seamless refresh)
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthFlowEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((accessToken) => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axiosInstance.post(endpoints.auth.refresh);
        const { accessToken, sessionExpiresAt } = data;

        sessionStorage.setItem(STORAGE_KEY, accessToken);
        // เพดานอายุเซสชันรวม (server เป็นคนคำนวณเสมอ) ไม่เปลี่ยนตอน refresh ปกติ แต่เขียนทับซ้ำ
        // ทุกครั้งเพื่อความชัวร์ — SessionTimeoutWatcher (jwt/session-timeout-watcher.jsx) อ่านค่านี้
        sessionStorage.setItem(SESSION_EXPIRES_KEY, sessionExpiresAt);
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        resolvePendingQueue(null, accessToken);

        if (isPermStale) {
          // dynamic import — axios.js ถูก import จาก server component ด้วย ห้ามดึง swr (client-only)
          // เข้า bundle ระดับ module; interceptor นี้รันเฉพาะฝั่ง browser อยู่แล้ว
          import('swr').then(({ mutate }) => {
            mutate(endpoints.users.myPermissions);
          });
        }

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        resolvePendingQueue(refreshError, null);
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_EXPIRES_KEY);
        delete axiosInstance.defaults.headers.common.Authorization;
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject((error.response && error.response.data) || 'Something went wrong!');
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args) => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args];

    const res = await axiosInstance.get(url, { ...config });

    return res.data;
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
};
