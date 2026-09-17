import { z } from 'zod';

export const getWashReceiveReportSchema = z.object({
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
