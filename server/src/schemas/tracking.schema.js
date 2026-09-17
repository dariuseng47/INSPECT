import { z } from 'zod';

export const locationByEpcSchema = z.object({
  params: z.object({ epc: z.string().min(1) }),
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const processStatusSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
