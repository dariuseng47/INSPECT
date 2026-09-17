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
  users: {
    myPermissions: '/users/me/permissions',
  },
};
