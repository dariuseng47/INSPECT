import axios from 'axios';

import { endpoints } from './endpoints';
import { clearTokens, getRefreshToken, setTokens, setSessionExpiresAt } from './tokenStore';

// Same base pattern as dashboard/src/utils/axios.js: EXPO_PUBLIC_* is Expo's
// build-time inlined env var convention (equivalent to Next's NEXT_PUBLIC_*).
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({ baseURL });
// Server uses this to gate certain actions behind approval when they originate from the
// mobile app — e.g. decommission requests need admin sign-off on the dashboard first
// (server/src/controllers/fabricItems.controller.js). Not a security boundary — just a
// workflow hint the server trusts, same trust level as the rest of this client's JWT-only auth.
apiClient.defaults.headers.common['X-Client-Type'] = 'mobile';

export function setAuthHeader(accessToken) {
  apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
}

export function clearAuthHeader() {
  delete apiClient.defaults.headers.common.Authorization;
}

// superadmin ไม่มี tenant ของตัวเองใน JWT — ต้องบอก server ทุกครั้งว่ากำลังจัดการโรงพยาบาลไหน
// โดยแนบ ?hospitalId= ไปกับทุก request (แพทเทิร์นเดียวกับ dashboard/src/hooks/use-effective-hospital.js)
// ค่าที่ผู้ใช้เลือกไว้ถูกจำผ่าน SecureStore และ set กลับเข้ามาที่นี่ตอนบูตแอป —
// ดู src/hospital/HospitalWorkspaceContext.jsx
let hospitalScopeId = null;
export function setHospitalScope(hospitalId) {
  hospitalScopeId = hospitalId || null;
}

apiClient.interceptors.request.use((config) => {
  // ไม่ทับค่า hospitalId ที่ผู้เรียกส่งมาเองอยู่แล้ว (เช่น flow ที่ผูก tenant จาก deviceId)
  if (hospitalScopeId != null && config.params?.hospitalId == null) {
    config.params = { ...config.params, hospitalId: hospitalScopeId };
  }
  return config;
});

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
