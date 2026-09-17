// Paths ported 1:1 from dashboard/src/utils/axios.js `endpoints`, trimmed to what
// the operator-focused mobile MVP calls.

export const endpoints = {
  auth: {
    me: '/auth/me',
    signIn: '/auth/login',
    signInPin: '/auth/login-pin',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  fabricItems: {
    list: '/fabric-items',
    // Detail response bundles { fabricItem, scanHistory } in one call — no separate
    // wash-history endpoint exists server-side (server/src/controllers/fabricItems.controller.js).
    details: (epc) => `/fabric-items/${epc}`,
    hold: (id) => `/fabric-items/${id}/hold`,
    decommission: (id) => `/fabric-items/${id}/decommission`,
  },
  hospitals: {
    // superadmin เท่านั้น (server/src/routes/hospitals.routes.js) — ใช้ให้ superadmin
    // เลือกว่ากำลังจัดการโรงพยาบาลไหนจากมือถือ
    list: '/hospitals',
  },
  users: {
    myHospitals: '/users/me/hospitals',
    myPermissions: '/users/me/permissions',
  },
  cabinets: {
    list: '/cabinets',
  },
  devices: {
    list: '/devices',
  },
  fabricLots: {
    list: '/fabric-lots',
  },
  fabricCategories: {
    list: '/fabric-categories',
  },
  scanSessions: {
    list: '/scan-sessions',
    details: (id) => `/scan-sessions/${id}`,
    report: (id) => `/scan-sessions/${id}/report`,
    confirm: (id) => `/scan-sessions/${id}/confirm`,
    cancel: (id) => `/scan-sessions/${id}/cancel`,
  },
  operations: {
    wardIssue: '/scans/ward-issue',
    wardReceive: '/scans/ward-receive',
    cabinetAudit: '/scans/cabinet-audit',
    statusChange: '/scans/status-change',
    wardIssueRounds: '/scans/ward-issue-rounds',
    location: (epc) => `/tracking/location/${epc}`,
    processStatus: '/tracking/process-status',
  },
};
