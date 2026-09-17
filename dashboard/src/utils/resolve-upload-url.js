import { CONFIG } from 'src/config-global';

// server เสิร์ฟไฟล์อัพโหลด (เช่น /uploads/phone-models/xxx.jpg) ที่ origin ตรงๆ ไม่ใช่ใต้ /api/v1 —
// และ dashboard กับ server มักรันคนละ origin กันตอน dev (คนละพอร์ต) ต่อให้ production อยู่หลัง
// reverse proxy เดียวกันก็ตาม — ต้องประกอบ URL เต็มเสมอ ใช้ path เปล่าๆ เป็น <img src> ตรงๆ ไม่ได้
const SERVER_ORIGIN = CONFIG.serverUrl.replace(/\/api\/v1\/?$/, '');

export function resolveUploadUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//.test(path)) return path;
  return `${SERVER_ORIGIN}${path}`;
}
