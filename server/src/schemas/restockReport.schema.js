import { z } from 'zod';

export const getRestockReportSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
      .optional(),
  }),
});

// รับทั้ง 'YYYY-MM-DD' และ 'YYYY-MM-DD HH:mm(:ss)' — ฝั่ง controller เติมเวลาให้เต็มเองถ้าส่งมาแค่วันที่
const dateTimeRegex = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/;

export const getFillHistorySchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    startDateTime: z.string().regex(dateTimeRegex, 'รูปแบบวันเวลาต้องเป็น YYYY-MM-DD HH:mm').optional(),
    endDateTime: z.string().regex(dateTimeRegex, 'รูปแบบวันเวลาต้องเป็น YYYY-MM-DD HH:mm').optional(),
    buildingId: z.coerce.number().int().positive().optional(),
    wardIds: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) : undefined)),
  }),
});
