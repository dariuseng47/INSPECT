import { z } from 'zod';

export const listScanBatchesSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
});

export const scanBatchParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
