import { z } from 'zod';

export const getRestockCartPlanSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
