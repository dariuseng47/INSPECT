import { z } from 'zod';

// roles มาจาก multipart form-data เป็น string เสมอ (JSON.stringify มาจากฝั่ง frontend) — parse ก่อน validate
const rolesField = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}, z.array(z.enum(['SUPERADMIN', 'ADMIN', 'OPERATOR'])).min(1, 'ต้องเลือกอย่างน้อย 1 บทบาท'));

// z.coerce.boolean() ใช้ Boolean(val) ตรงๆ ซึ่ง string 'false' ก็ยัง truthy — ต้อง map ค่า string เองก่อน
const booleanField = z.preprocess((val) => {
  if (typeof val === 'string') return val === 'true';
  return val;
}, z.boolean());

export const createLoginPopupImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().min(1, 'ต้องอัปโหลดรูปภาพ'),
    roles: rolesField,
    sortOrder: z.coerce.number().int().optional().default(0),
    isActive: booleanField.optional().default(true),
  }),
});

export const updateLoginPopupImageSchema = z.object({
  body: z.object({
    imageUrl: z.string().optional(),
    roles: rolesField.optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: booleanField.optional(),
  }),
  params: z.object({
    id: z.coerce.number().int(),
  }),
});

export const deleteLoginPopupImageSchema = z.object({
  params: z.object({
    id: z.coerce.number().int(),
  }),
});
