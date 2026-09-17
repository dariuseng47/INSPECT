import { apiClient } from './client';

// effective permission ของผู้ใช้ปัจจุบัน — ฝั่ง handheld สนใจเฉพาะคีย์ handheld.*
// (server/src/config/menuCatalog.js) ที่ backend เป็นตัวบังคับใช้จริงอีกชั้น
export async function fetchMyPermissions() {
  const { data } = await apiClient.get('/users/me/permissions');
  return data.permissions || [];
}
