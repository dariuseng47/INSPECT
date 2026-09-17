import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3033'),

  DB_HOST: z.string().min(1, 'DB_HOST ห้ามว่าง — กรอกใน server/.env'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1, 'DB_USER ห้ามว่าง — กรอกใน server/.env'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD ห้ามว่าง — กรอกใน server/.env'),
  DB_NAME: z.string().min(1, 'DB_NAME ห้ามว่าง — กรอกใน server/.env'),
  // z.coerce.boolean() ใช้ไม่ได้กับ string "false" (non-empty string ใดๆ coerce เป็น true เสมอ)
  DB_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DB_CONNECTION_LIMIT: z.coerce.number().default(10),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET ต้องมีความยาวอย่างน้อย 32 ตัวอักษร'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET ต้องมีความยาวอย่างน้อย 32 ตัวอักษร'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  // เพดานอายุ "เซสชัน" นับจาก login ครั้งแรก (ไม่ใช่อายุของ refresh token แต่ละใบ) — ต่างจาก
  // REFRESH_TOKEN_TTL ตรงที่ต่อให้ผู้ใช้ยัง active ต่อเนื่องจน refresh token ถูก rotate ไปเรื่อยๆ
  // ก็ยังต้อง login ใหม่เมื่อครบเวลานี้อยู่ดี ดู server/src/utils/tokens.js (claim session_started_at)
  SESSION_MAX_TTL_HOURS: z.coerce.number().positive().default(8),
  // ใช้ทำ HMAC-SHA256(pin, PIN_PEPPER) สำหรับ login PIN 6 หลักจาก handheld — ดู
  // server/src/utils/pin.js (ต้อง deterministic เพื่อ lookup + UNIQUE constraint ได้ตรงๆ
  // ต่างจาก password ที่ใช้ bcrypt สุ่ม salt)
  PIN_PEPPER: z.string().min(32, 'PIN_PEPPER ต้องมีความยาวอย่างน้อย 32 ตัวอักษร'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ ตั้งค่าไฟล์ server/.env ไม่ครบหรือไม่ถูกต้อง:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const CORS_ORIGINS = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

// วงแลนบ้าน/ออฟฟิศ: localhost, 192.168.x.x, 10.x.x.x, 172.16–31.x.x — พอร์ตใดก็ได้
const LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

// dev: อนุญาต origin ในวงแลนทั้งหมด (เปิด dashboard ผ่าน IP เครื่อง server ได้โดยไม่ต้องแก้ env)
// prod: ล็อกเฉพาะรายการใน CORS_ORIGIN เท่านั้น
export function isAllowedOrigin(origin) {
  if (!origin) return true; // ไม่มี Origin header (curl, same-origin, health check)
  if (CORS_ORIGINS.includes(origin)) return true;
  return env.NODE_ENV !== 'production' && LAN_ORIGIN_RE.test(origin);
}
