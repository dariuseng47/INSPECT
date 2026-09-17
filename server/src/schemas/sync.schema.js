import { z } from 'zod';

export const syncBatchSchema = z.object({
  body: z.object({
    events: z
      .array(
        z
          .object({
            epcCode: z.string().min(1).max(64),
            eventType: z.enum(['WARD_ISSUE', 'WARD_RECEIVE']),
            cabinetId: z.coerce.number().int().positive().optional(),
            scannedAt: z.coerce.date(),
          })
          .refine((data) => data.eventType !== 'WARD_ISSUE' || data.cabinetId !== undefined, {
            message: 'ต้องระบุ cabinetId เมื่อ eventType เป็น WARD_ISSUE',
            path: ['cabinetId'],
          })
      )
      .min(1)
      .max(500),
  }),
});

export const listConflictsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const approveConflictSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    chosen: z.enum(['A', 'B']),
  }),
});
