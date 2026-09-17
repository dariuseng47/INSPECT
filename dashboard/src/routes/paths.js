const ROOTS = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  page403: '/error/403',
  page404: '/error/404',
  page500: '/error/500',
  // AUTH
  auth: {
    jwt: {
      signIn: `${ROOTS.AUTH}/jwt/sign-in`,
      signUp: `${ROOTS.AUTH}/jwt/sign-up`,
    },
  },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
    security: {
      users: `${ROOTS.DASHBOARD}/security/users`,
      auditLogs: `${ROOTS.DASHBOARD}/security/audit-logs`,
      loginPopups: `${ROOTS.DASHBOARD}/security/login-popups`,
    },
    settings: {
      superadmin: `${ROOTS.DASHBOARD}/settings/superadmin`,
    },
  },
};
