import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Centralized error handler — sanitize error output ตอน production เสมอ (ห้ามหลุด stack trace / raw MySQL error)
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }

  const isProd = env.NODE_ENV === 'production';

  if (!isProd) {
    console.error(err);
  }

  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: isProd ? 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' : err.message,
  });
}
