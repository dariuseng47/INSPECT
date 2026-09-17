import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import multer from 'multer';

import { AppError } from '../utils/AppError.js';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const HOLD_PHOTO_DIR = path.join(UPLOAD_ROOT, 'hold-decommission');
fs.mkdirSync(HOLD_PHOTO_DIR, { recursive: true });

const LOGIN_POPUP_IMAGE_DIR = path.join(UPLOAD_ROOT, 'login-popup-images');
fs.mkdirSync(LOGIN_POPUP_IMAGE_DIR, { recursive: true });

// ล๊อคขนาดไฟล์รูปพัก/ชำรุดไม่เกิน 2MB ตามที่กำหนด
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// ตรวจชนิดไฟล์จาก "magic bytes" จริงของเนื้อไฟล์ ห้ามเชื่อ mimetype ที่ client ส่งมาใน
// multipart header เพียงอย่างเดียว เพราะปลอมได้ง่าย (เช่น อัปโหลดไฟล์อื่นแล้วตั้ง
// Content-Type: image/jpeg เอง) — เช็คนี้คือด่านที่ป้องกันการปลอมชนิดไฟล์จริง
const SIGNATURE_CHECKS = [
  { ext: '.jpg', matches: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff },
  {
    ext: '.png',
    matches: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    ext: '.webp',
    matches: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
];

function detectImageExtension(buffer) {
  return SIGNATURE_CHECKS.find((check) => check.matches(buffer))?.ext ?? null;
}

// buffer ในหน่วยความจำก่อน (ไฟล์เล็กสุด 2MB อยู่แล้ว ไม่กระทบ memory) แล้วค่อยเขียนลงดิสก์เอง
// หลังผ่านการตรวจ magic bytes แล้วเท่านั้น — ไม่เขียนไฟล์ที่ยังไม่ผ่านการตรวจสอบลงดิสก์เด็ดขาด
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('photo');

const multerUploadLoginPopupImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('image');

// wrap ด้วยมือเพราะ multer เป็น callback-style ไม่ใช่ promise ใช้กับ asyncHandler ตรงๆ ไม่ได้
// และต้อง map error เป็น AppError ให้ errorHandler กลาง (server/src/middleware/errorHandler.js) จัดการต่อได้
export function uploadHoldPhoto(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'FILE_TOO_LARGE', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB'));
      return;
    }
    if (err) {
      next(err);
      return;
    }

    // multipart form-data ที่ไม่มีไฟล์แนบมา ก็ยัง parse text field (reasonCode) เข้า req.body ได้ปกติ
    if (!req.file) {
      next();
      return;
    }

    const ext = detectImageExtension(req.file.buffer);
    if (!ext) {
      next(new AppError(400, 'INVALID_FILE_TYPE', 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น'));
      return;
    }

    // ตั้งชื่อไฟล์ใหม่แบบสุ่มเสมอ ห้ามใช้ชื่อไฟล์เดิมที่ผู้ใช้อัปโหลดมา (กัน path traversal / ชื่อชนกัน)
    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFile(path.join(HOLD_PHOTO_DIR, filename), req.file.buffer, (writeErr) => {
      if (writeErr) {
        next(writeErr);
        return;
      }
      req.body.photoUrl = `/uploads/hold-decommission/${filename}`;
      next();
    });
  });
}

// รูป popup หลัง login — ไฟล์เป็น optional ตอน update (แก้แค่ roles/order/active โดยไม่เปลี่ยนรูปได้)
// จึงไม่ throw ตอนไม่มี req.file เหมือน uploadHoldPhoto (ที่นั่น optional เพราะเหตุผลอื่น — พักผ้าไม่มีรูปได้)
export function uploadLoginPopupImage(req, res, next) {
  multerUploadLoginPopupImage(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'FILE_TOO_LARGE', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 2MB'));
      return;
    }
    if (err) {
      next(err);
      return;
    }

    if (!req.file) {
      next();
      return;
    }

    const ext = detectImageExtension(req.file.buffer);
    if (!ext) {
      next(new AppError(400, 'INVALID_FILE_TYPE', 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น'));
      return;
    }

    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFile(path.join(LOGIN_POPUP_IMAGE_DIR, filename), req.file.buffer, (writeErr) => {
      if (writeErr) {
        next(writeErr);
        return;
      }
      req.body.imageUrl = `/uploads/login-popup-images/${filename}`;
      next();
    });
  });
}
