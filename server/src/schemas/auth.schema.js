import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(100),
    password: z.string().min(8).max(200),
  }),
});

export const loginPinSchema = z.object({
  body: z.object({
    pin: z.string().regex(/^\d{6}$/, 'PIN ต้องเป็นตัวเลข 6 หลัก'),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    // web ใช้ HttpOnly cookie อยู่แล้ว ส่วน mobile ส่งมาทาง body
    refreshToken: z.string().min(10).optional(),
  }),
});
