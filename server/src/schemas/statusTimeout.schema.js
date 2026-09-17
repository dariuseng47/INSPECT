import { z } from 'zod';

export const TIMEOUT_STATUSES = ['WASH', 'CENTRAL_STOCK'];

export const listStatusTimeoutsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const upsertStatusTimeoutsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
  body: z.object({
    settings: z
      .array(
        z.object({
          status: z.enum(TIMEOUT_STATUSES),
          maxHours: z.coerce.number().int().positive().max(720),
        })
      )
      .min(1),
  }),
});
