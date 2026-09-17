import { z } from 'zod';

export const triggerScanSessionSchema = z.object({
  body: z
    .object({
      // ผูกล็อต หรือระบุแค่หมวดหมู่ตรงๆ (ไม่ผูกล็อต) ก็ได้ อย่างใดอย่างหนึ่ง
      fabricLotId: z.coerce.number().int().positive().optional(),
      fabricCategoryId: z.coerce.number().int().positive().optional(),
      deviceId: z.coerce.number().int().positive(),
    })
    .refine((data) => data.fabricLotId || data.fabricCategoryId, {
      message: 'ต้องระบุ fabricLotId หรือ fabricCategoryId อย่างน้อยหนึ่งอย่าง',
      path: ['fabricLotId'],
    }),
});

export const scanSessionParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const listScanSessionsSchema = z.object({
  query: z.object({
    // superadmin ต้องระบุ hospitalId (resolveTenantId บังคับอยู่แล้ว) — admin/operator ไม่ต้อง
    hospitalId: z.coerce.number().int().positive().optional(),
    // คั่นด้วย comma ได้ เช่น "REPORTED" หรือ "PENDING,SCANNING,REPORTED" (default = ที่ยังค้าง)
    status: z.string().optional(),
  }),
});

export const reportScanSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1),
  }),
});

export const confirmScanSessionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    // แอดมินตัด EPC ที่ไม่ต้องการออกได้ก่อน confirm (default = ยืนยันทั้งหมดที่ scan เจอ)
    epcCodes: z.array(z.string().min(1).max(64)).min(1).optional(),
  }),
});
