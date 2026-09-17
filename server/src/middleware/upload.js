import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import multer from 'multer';

import { AppError } from '../utils/AppError.js';

export const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

const LOGIN_POPUP_IMAGE_DIR = path.join(UPLOAD_ROOT, 'login-popup-images');
fs.mkdirSync(LOGIN_POPUP_IMAGE_DIR, { recursive: true });

const PHONE_MODEL_IMAGE_DIR = path.join(UPLOAD_ROOT, 'phone-models');
fs.mkdirSync(PHONE_MODEL_IMAGE_DIR, { recursive: true });

const PHONE_SCAN_DIR = path.join(UPLOAD_ROOT, 'phone-scans');
fs.mkdirSync(PHONE_SCAN_DIR, { recursive: true });

// ล๊อคขนาดไฟล์รูปไม่เกิน 2MB (login popup) — ภาพโทรศัพท์ (ถ่ายวางเรียงบนถาด/อ้างอิง) ใหญ่กว่านั้นได้
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_PHONE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

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
const multerUploadLoginPopupImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
}).single('image');

// wrap ด้วยมือเพราะ multer เป็น callback-style ไม่ใช่ promise ใช้กับ asyncHandler ตรงๆ ไม่ได้
// และต้อง map error เป็น AppError ให้ errorHandler กลาง (server/src/middleware/errorHandler.js) จัดการต่อได้
//
// รูป popup หลัง login — ไฟล์เป็น optional ตอน update (แก้แค่ roles/order/active โดยไม่เปลี่ยนรูปได้)
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

// เขียนไฟล์ทีละ buffer ที่ผ่านการตรวจ magic bytes แล้วลง dir ที่กำหนด คืน URL สาธารณะ (/uploads/...)
function writeImageFile(dir, publicPrefix, buffer) {
  return new Promise((resolve, reject) => {
    const ext = detectImageExtension(buffer);
    if (!ext) {
      reject(new AppError(400, 'INVALID_FILE_TYPE', 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น'));
      return;
    }
    const filename = `${crypto.randomUUID()}${ext}`;
    fs.writeFile(path.join(dir, filename), buffer, (err) => {
      if (err) reject(err);
      else resolve(`${publicPrefix}/${filename}`);
    });
  });
}

const multerPhoneModelImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHONE_IMAGE_SIZE_BYTES, files: 30 },
}).array('images', 30);

// ภาพอ้างอิง (training images) ของรุ่นโทรศัพท์ — อัพได้หลายภาพพร้อมกัน ผลลัพธ์เก็บเป็น
// req.uploadedImageUrls: string[] ให้ controller เอาไป insert phone_model_images ต่อ
export function uploadPhoneModelImages(req, res, next) {
  multerPhoneModelImages(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'FILE_TOO_LARGE', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB ต่อไฟล์'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.files?.length) {
      next(new AppError(400, 'VALIDATION_ERROR', 'ต้องแนบไฟล์รูปภาพอย่างน้อย 1 ไฟล์'));
      return;
    }
    try {
      req.uploadedImageUrls = await Promise.all(
        req.files.map((file) => writeImageFile(PHONE_MODEL_IMAGE_DIR, '/uploads/phone-models', file.buffer))
      );
      next();
    } catch (writeErr) {
      next(writeErr);
    }
  });
}

const multerPhoneScanImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHONE_IMAGE_SIZE_BYTES },
}).single('image');

// ภาพสแกน (วางเรียงบนโต๊ะ/ถาด) จากหน้า "ตรวจสอบรุ่นโทรศัพท์" — ไฟล์เดียวต่อ 1 รอบสแกน
// เก็บ buffer ดิบไว้ที่ req.file.buffer ให้ controller เอาไปเรียก ML-Service ต่อโดยตรง (ไม่ต้อง
// เขียนลงดิสก์ก่อน เพราะต้อง detect/crop/annotate ก่อนถึงจะรู้ path สุดท้ายที่จะ save จริง)
export function uploadPhoneScanImage(req, res, next) {
  multerPhoneScanImage(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError(400, 'FILE_TOO_LARGE', 'ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10MB'));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    if (!req.file) {
      next(new AppError(400, 'VALIDATION_ERROR', 'ต้องแนบไฟล์รูปภาพ'));
      return;
    }
    const ext = detectImageExtension(req.file.buffer);
    if (!ext) {
      next(new AppError(400, 'INVALID_FILE_TYPE', 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น'));
      return;
    }
    next();
  });
}

export async function savePhoneScanFile(buffer, extension) {
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.promises.writeFile(path.join(PHONE_SCAN_DIR, filename), buffer);
  return `/uploads/phone-scans/${filename}`;
}

export async function savePhoneModelImageBuffer(buffer) {
  return writeImageFile(PHONE_MODEL_IMAGE_DIR, '/uploads/phone-models', buffer);
}

export function unlinkUploadedImage(imageUrl) {
  if (!imageUrl) return;
  const filePath = path.join(UPLOAD_ROOT, imageUrl.replace(/^\/uploads\//, ''));
  fs.unlink(filePath, () => {});
}
