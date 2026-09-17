import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(100),
    password: z.string().min(8).max(200),
    // PIN 6 หลักสำหรับ login จาก handheld (ดู server/src/utils/pin.js) — บังคับทุก user ใหม่
    // ห้ามซ้ำกับของคนอื่น (เช็ค + คืน error ที่ users.controller.js, DB มี UNIQUE คุมอีกชั้น)
    pin: z.string().regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก'),
    fullName: z.string().min(1).max(150),
    phone: z.string().max(30).optional(),
    role: z.enum(['SUPERADMIN', 'ADMIN', 'OPERATOR']),
    handheldEnabled: z.boolean().optional(),
    canManageSubordinates: z.boolean().optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    fullName: z.string().min(1).max(150).optional(),
    phone: z.string().max(30).optional(),
    isActive: z.boolean().optional(),
    handheldEnabled: z.boolean().optional(),
    canManageSubordinates: z.boolean().optional(),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    // CSV เช่น "ADMIN,OPERATOR" — ดู listUsers ใน users.controller.js สำหรับ parsing
    role: z.string().max(100).optional(),
  }),
});

export const userPermissionsParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const updateUserPermissionsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    overrides: z
      .array(
        z.object({
          permKey: z.string().min(1).max(100),
          effect: z.enum(['GRANT', 'DENY']).nullable(),
        })
      )
      .min(1),
  }),
});
