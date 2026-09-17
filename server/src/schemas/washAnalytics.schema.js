import { z } from 'zod';

export const getWashAnalyticsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
