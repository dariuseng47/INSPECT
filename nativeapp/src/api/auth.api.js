import { apiClient } from './client';
import { endpoints } from './endpoints';

export async function login({ username, password }) {
  const { data } = await apiClient.post(endpoints.auth.signIn, { username, password });
  return data; // { accessToken, refreshToken, user }
}

export async function loginWithPin({ pin }) {
  const { data } = await apiClient.post(endpoints.auth.signInPin, { pin });
  return data; // { accessToken, refreshToken, user }
}

export async function fetchMe() {
  const { data } = await apiClient.get(endpoints.auth.me);
  return data; // { user, permVersion }
}

export async function logout({ refreshToken }) {
  await apiClient.post(endpoints.auth.logout, { refreshToken }).catch(() => {});
}
