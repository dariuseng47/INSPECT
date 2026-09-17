import { z } from 'zod';

// เพิ่มเข้ามาเพื่อรองรับ nativeapp/ (มือถือ operator) — ดู docs/api-spec.md
// weight-gate/bundle-check (device token, ดู middleware/authenticateDevice.js) อยู่ท้ายไฟล์นี้

export const wardIssueSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1).max(64),
    cabinetId: z.coerce.number().int().positive(),
    // ไม่บังคับ — ใส่มาก็ต่อเมื่อสแกนต่อจากขั้นตรวจนับตู้ผ้า (cabinet-audit) เพื่อผูกเข้า "รอบ" เดียวกัน
    // ให้หน้าประวัติการจ่ายผ้าสรุปได้ว่ารอบนี้จ่ายอะไรไปบ้าง
    roundId: z.coerce.number().int().positive().optional(),
  }),
});

export const wardReceiveSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1).max(64),
  }),
});

export const cabinetAuditSchema = z.object({
  body: z.object({
    cabinetId: z.coerce.number().int().positive(),
    // อนุญาต [] ได้ — เคส "เติมผ้าครั้งแรก" ตู้เปล่าไม่มีผ้าเดิมคงเหลือให้สแกน ถือเป็นการตรวจนับที่ผลลัพธ์
    // คือ "ไม่เจอผ้าเลย" (reconciliation จะโชว์ขาดเต็ม par level) แล้วปลดล็อกขั้นจ่ายผ้าเข้าตู้ต่อได้
    epcCodes: z.array(z.string().min(1).max(64)).max(500),
  }),
});

export const listWardIssueRoundsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const washReceiveBatchSchema = z.object({
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1).max(500),
    weightKg: z.coerce.number().nonnegative(),
  }),
});

// "เปลี่ยนสถานะผ้า" — เลือกสถานะก่อน/หลังเองได้ทุกคู่ในกลุ่ม flow ปกติ (ไม่รวม HOLD/แทงชำรุด
// ที่มี flow อนุมัติแยก) สแกนเป็นชุด confirm=false = ดูผลตรวจสอบก่อน, confirm=true = เปลี่ยนจริง
const STATUS_CHANGE_STATUSES = ['WASH', 'CENTRAL_STOCK', 'WARD_CABINET', 'IN_USE_WARD'];

export const statusChangeSchema = z.object({
  body: z
    .object({
      epcCodes: z.array(z.string().min(1).max(64)).min(1).max(500),
      fromStatus: z.enum(STATUS_CHANGE_STATUSES),
      toStatus: z.enum(STATUS_CHANGE_STATUSES),
      confirm: z.boolean().optional().default(false),
    })
    .refine((data) => data.fromStatus !== data.toStatus, {
      message: 'สถานะก่อนและหลังต้องไม่เหมือนกัน',
      path: ['toStatus'],
    }),
});

export const stockScanSchema = z.object({
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1).max(500),
    deviceId: z.coerce.number().int().positive().optional(),
  }),
});

export const listStockScanRoundsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const weightGateSchema = z.object({
  body: z
    .object({
      epcCodes: z.array(z.string().min(1).max(64)).min(1).max(200),
      weightKg: z.coerce.number().nonnegative().optional(),
      sensorError: z.boolean().optional().default(false),
    })
    .refine((data) => data.sensorError || data.weightKg !== undefined, {
      message: 'ต้องระบุ weightKg เว้นแต่ sensorError = true',
      path: ['weightKg'],
    }),
});

export const bundleCheckSchema = z.object({
  body: z.object({
    epcCodes: z.array(z.string().min(1).max(64)).min(1).max(200),
    rssiDbm: z.coerce.number().optional(),
  }),
});
