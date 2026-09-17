import axios from 'axios';

import { CONFIG } from 'src/config-global';

import { STORAGE_KEY, SESSION_EXPIRES_KEY } from 'src/auth/context/jwt/constant';

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/auth/me',
    signIn: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  hospitals: {
    list: '/hospitals',
    summary: '/hospitals/summary',
    details: (id) => `/hospitals/${id}`,
    dashboardSummary: (id) => `/hospitals/${id}/dashboard-summary`,
  },
  users: {
    list: '/users',
    details: (id) => `/users/${id}`,
    permissions: (id) => `/users/${id}/permissions`,
    myPermissions: '/users/me/permissions',
    myHospitals: '/users/me/hospitals',
  },
  fabricCategories: {
    list: '/fabric-categories',
    details: (id) => `/fabric-categories/${id}`,
  },
  fabricLots: {
    list: '/fabric-lots',
  },
  fabricItems: {
    list: '/fabric-items',
    bulk: '/fabric-items/bulk',
    details: (epc) => `/fabric-items/${epc}`,
    hold: (id) => `/fabric-items/${id}/hold`,
    decommission: (id) => `/fabric-items/${id}/decommission`,
  },
  devices: {
    list: '/devices',
    rotateToken: (id) => `/devices/${id}/rotate-token`,
  },
  rfidReader: {
    scan: '/rfid-reader/scan',
  },
  restockReport: {
    get: '/restock-report',
    fillHistory: '/restock-report/fill-history',
  },
  restockCartPlan: {
    get: '/restock-cart-plan',
  },
  washReceiveReport: {
    get: '/wash-receive-report',
  },
  departments: {
    list: '/departments',
    details: (id) => `/departments/${id}`,
  },
  cabinets: {
    list: '/cabinets',
    details: (id) => `/cabinets/${id}`,
    parLevels: (id) => `/cabinets/${id}/par-levels`,
  },
  auditLogs: {
    list: '/audit-logs',
  },
  statusTimeouts: {
    list: '/status-timeout-settings',
  },
  alerts: {
    list: '/alerts',
  },
  washAnalytics: {
    list: '/wash-analytics',
  },
  globalSettings: {
    list: '/global-settings',
  },
  loginPopupImages: {
    list: '/login-popup-images',
    forMe: '/login-popup-images/for-me',
    details: (id) => `/login-popup-images/${id}`,
  },
  transfers: {
    list: '/transfers',
  },
  sync: {
    conflicts: '/sync/conflicts',
    approve: (id) => `/sync/conflicts/${id}/approve`,
  },
  decommissionRequests: {
    list: '/decommission-requests',
    approve: (id) => `/decommission-requests/${id}/approve`,
    reject: (id) => `/decommission-requests/${id}/reject`,
  },
  scanSessions: {
    list: '/scan-sessions',
    details: (id) => `/scan-sessions/${id}`,
    report: (id) => `/scan-sessions/${id}/report`,
    confirm: (id) => `/scan-sessions/${id}/confirm`,
    cancel: (id) => `/scan-sessions/${id}/cancel`,
  },
  scans: {
    wardIssue: '/scans/ward-issue',
    wardReceive: '/scans/ward-receive',
    washReceiveBatch: '/scans/wash-receive-batch',
    stockScan: '/scans/stock-scan',
    stockScanRounds: '/scans/stock-scan-rounds',
    statusChange: '/scans/status-change',
  },
  tracking: {
    location: (epc) => `/tracking/location/${epc}`,
    processStatus: '/tracking/process-status',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
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
    // permission set + รายชื่อโรงพยาบาลใหม่ เพื่อให้เมนู/ปุ่มอัปเดตตามทันที
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
            mutate(endpoints.users.myHospitals);
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
