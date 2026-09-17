import { z } from 'zod';

const FABRIC_STATUSES = [
  'WASH',
  'CENTRAL_STOCK',
  'WARD_CABINET',
  'IN_USE_WARD',
  'HOLD',
  'DECOMMISSIONED',
  'PENDING_DECOMMISSION',
];

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    description: z.string().max(500).optional(),
    maxWashCycles: z.coerce.number().int().positive().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(500).optional(),
    maxWashCycles: z.coerce.number().int().positive().optional(),
  }),
});

export const listCategoriesSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createLotSchema = z.object({
  body: z.object({
    lotCode: z.string().min(1).max(100),
    purchasedAt: z.string().optional(),
    quantity: z.coerce.number().int().positive(),
    fabricCategoryId: z.coerce.number().int().positive().optional(),
    maxWashCycles: z.coerce.number().int().positive().optional(),
    maxUsageMonths: z.coerce.number().int().positive().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const listLotsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const listFabricItemsSchema = z.object({
  query: z.object({
    status: z.enum(FABRIC_STATUSES).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    lotId: z.coerce.number().int().positive().optional(),
    epcCode: z.string().optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createFabricItemSchema = z.object({
  body: z
    .object({
      epcCode: z.string().min(1).max(64),
      fabricCategoryId: z.coerce.number().int().positive().optional(),
      fabricLotId: z.coerce.number().int().positive().optional(),
      photoUrl: z.string().max(500).optional(),
      hospitalId: z.coerce.number().int().positive().optional(),
    })
    // ถ้าไม่ผูกล็อต ต้องระบุหมวดหมู่เอง — ถ้าผูกล็อต จะดึงหมวดหมู่จากล็อตให้อัตโนมัติ
    .refine((data) => data.fabricCategoryId || data.fabricLotId, {
      message: 'ต้องระบุ fabricCategoryId หรือ fabricLotId อย่างน้อยหนึ่งอย่าง',
      path: ['fabricCategoryId'],
    }),
});

// ลงทะเบียนผ้าหลายชิ้นพร้อมกัน (เช่น รับผ้าล็อตใหม่ทีละหลัก 100 ชิ้น) — ทุกชิ้นแชร์หมวดหมู่/ล็อต
// เดียวกัน ต่างกันแค่ epcCode รายชิ้น จำกัดไว้ 500 รายการต่อคำขอกันโหลดคำขอใหญ่เกินไป
export const bulkCreateFabricItemsSchema = z.object({
  body: z
    .object({
      epcCodes: z.array(z.string().min(1).max(64)).min(1).max(500),
      fabricCategoryId: z.coerce.number().int().positive().optional(),
      fabricLotId: z.coerce.number().int().positive().optional(),
      photoUrl: z.string().max(500).optional(),
      hospitalId: z.coerce.number().int().positive().optional(),
    })
    .refine((data) => data.fabricCategoryId || data.fabricLotId, {
      message: 'ต้องระบุ fabricCategoryId หรือ fabricLotId อย่างน้อยหนึ่งอย่าง',
      path: ['fabricCategoryId'],
    }),
});

export const fabricItemDetailSchema = z.object({
  params: z.object({ epc: z.string().min(1) }),
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const holdDecommissionSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    reasonCode: z.string().min(1).max(100),
    photoUrl: z.string().max(500).optional(),
  }),
});
