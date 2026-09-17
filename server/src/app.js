import express from 'express';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { UPLOAD_ROOT } from './middleware/upload.js';
import { errorHandler } from './middleware/errorHandler.js';
import { corsMiddleware, globalRateLimiter, helmetMiddleware } from './middleware/security.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // production (welcleankhoka.com) รันหลัง reverse proxy ของ Plesk (nginx terminate TLS แล้วส่งต่อ
  // เป็น HTTP ธรรมดามาที่ Node บน port ภายใน) — ถ้าไม่ตั้งค่านี้ req.ip ของทุก request จะกลายเป็น
  // IP ของ proxy เดียวกันหมด (ไม่ใช่ IP ผู้ใช้จริง) ทำให้ globalRateLimiter/authRateLimiter/
  // pinLoginRateLimiter (ผูก key กับ req.ip) นับรวมผู้ใช้ทุกคนเป็นโควตาเดียวกัน — คนหนึ่งโดนบล็อก
  // จะทำให้คนอื่นโดนบล็อกไปด้วย ตั้งเป็น 1 (เชื่อ proxy hop แรกสุด) พอสำหรับ layout แบบนี้
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  // เสิร์ฟไฟล์ที่อัปโหลด (เช่น รูปพัก/ชำรุด, รูป popup หลัง login) — ชื่อไฟล์เป็น UUID สุ่มเสมอ
  // (ดู middleware/upload.js) จึงเดาชื่อไฟล์คนอื่นไม่ได้ ไม่ต้องผ่าน authenticate เพื่อให้ <img src>
  // ฝั่ง dashboard โหลดตรงได้เลย — express.static กัน path traversal (../) ให้อัตโนมัติอยู่แล้ว
  //
  // helmetMiddleware (ด้านบน) ตั้ง Cross-Origin-Resource-Policy: same-origin เป็นค่า default ซึ่ง
  // บล็อกเบราว์เซอร์ไม่ให้โหลดรูปข้าม origin (เช่น dashboard localhost:3033 โหลดรูปจาก backend
  // localhost:4000 ตอน dev หรือคนละ subdomain ตอน production) ทั้งที่ endpoint นี้ตั้งใจให้เข้าถึง
  // แบบ public/cross-origin อยู่แล้วตามคอมเมนต์ด้านบน — ผ่อนเฉพาะ route นี้ให้เป็น cross-origin
  // โดยไม่กระทบ CORP ของ endpoint อื่นที่เหลือ (ยังคง same-origin ตามปกติ)
  app.use('/uploads', (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.use('/uploads', express.static(UPLOAD_ROOT, { index: false, dotfiles: 'deny' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', routes);

  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(errorHandler);

  return app;
}
