import { paths } from 'src/routes/paths';

import packageJson from '../package.json';

// ----------------------------------------------------------------------

// NEXT_PUBLIC_SERVER_URL ถูก bake ตอน build ไว้เป็น http://localhost:4000/api/v1
// เวลาเปิด dashboard จากเครื่องอื่นในวงแลน (เช่น http://192.168.1.109:3033) คำว่า "localhost"
// จะหมายถึงเครื่องของผู้เปิดเอง ทำให้ request ยิงไป backend ไม่ถึง
// แก้: ถ้า host ที่ตั้งไว้เป็น loopback (localhost/127.0.0.1) แต่หน้าเว็บถูกเปิดผ่าน hostname อื่น
// ให้สลับ host ของ serverUrl เป็น hostname เดียวกับที่เบราว์เซอร์ใช้เปิดหน้านี้ (พอร์ต/พาธเดิม)
function resolveServerUrl() {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL ?? '';
  if (typeof window === 'undefined' || !configured) return configured;

  try {
    const url = new URL(configured);
    const isLoopback = ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname);
    if (isLoopback && window.location.hostname && window.location.hostname !== url.hostname) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    /* ค่า env ไม่ใช่ URL ที่ parse ได้ — ใช้ค่าเดิมไปตามนั้น */
  }

  return configured;
}

export const CONFIG = {
  appName: 'Minimal UI',
  appVersion: packageJson.version,
  serverUrl: resolveServerUrl(),
  assetsDir: process.env.NEXT_PUBLIC_ASSETS_DIR ?? '',
  isStaticExport: JSON.parse(`${process.env.BUILD_STATIC_EXPORT}`),
  /**
   * Auth
   * @method jwt
   */
  auth: {
    method: 'jwt',
    skip: false,
    redirectPath: paths.dashboard.root,
  },
};
