import axios from 'axios';

import { endpoints } from './endpoints';
import { clearTokens, getRefreshToken, setTokens, setSessionExpiresAt } from './tokenStore';

// Same base pattern as dashboard/src/utils/axios.js: EXPO_PUBLIC_* is Expo's
// build-time inlined env var convention (equivalent to Next's NEXT_PUBLIC_*).
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// server เสิร์ฟไฟล์อัพโหลด (เช่น /uploads/phone-scans/xxx.png) ที่ root ไม่ใช่ใต้ /api/v1 —
// ตัด /api/v1 ต่อท้าย baseURL ออกเพื่อได้ origin เปล่าๆ ไว้ประกอบ URL รูปแบบเต็มให้ <Image>
export const serverOrigin = baseURL.replace(/\/api\/v1\/?$/, '');

export function resolveUploadUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${serverOrigin}${path}`;
}

export const apiClient = axios.create({ baseURL });
// Lets the server distinguish requests that originate from this mobile app. Not a security
// boundary — just a workflow hint the server trusts, same trust level as the rest of this
// client's JWT-only auth.
apiClient.defaults.headers.common['X-Client-Type'] = 'mobile';

export function setAuthHeader(accessToken) {
  apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
}

export function clearAuthHeader() {
  delete apiClient.defaults.headers.common.Authorization;
}

// AuthContext registers this so the interceptor can hand control back to it
// (clear session state, route to login) when a refresh ultimately fails —
// keeps this module free of any React/navigation dependency.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// AuthContext registers this — เรียกหลัง refresh สำเร็จที่ถูก trigger ด้วย 401 PERM_STALE
// (server/src/middleware/authenticate.js) เพื่อให้ดึง permission set ใหม่มา gate เมนู
let onPermStale = () => {};
export function setPermStaleHandler(handler) {
  onPermStale = handler;
}

// Queue concurrent 401s while a single refresh is in flight, same as the web
// client's `pendingQueue` — avoids firing /auth/refresh once per failed request.
let isRefreshing = false;
let pendingQueue = [];

function resolvePendingQueue(error, accessToken) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(accessToken);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthFlowEndpoint =
      originalRequest?.url === endpoints.auth.signIn ||
      originalRequest?.url === endpoints.auth.signInPin ||
      originalRequest?.url === endpoints.auth.refresh;

    const isPermStale = error.response?.data?.error === 'PERM_STALE';

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthFlowEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((accessToken) => {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        const { data } = await apiClient.post(endpoints.auth.refresh, { refreshToken });

        await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
        await setSessionExpiresAt(data.sessionExpiresAt);
        setAuthHeader(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        resolvePendingQueue(null, data.accessToken);
        if (isPermStale) onPermStale();
        return apiClient(originalRequest);
      } catch (refreshError) {
        resolvePendingQueue(refreshError, null);
        await clearTokens();
        clearAuthHeader();
        onSessionExpired();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject((error.response && error.response.data) || 'Something went wrong!');
  }
);
