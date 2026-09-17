import { z } from 'zod';

export const createHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    region: z.string().max(100).optional(),
  }),
});

export const updateHospitalSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    quotaConfig: z.record(z.any()).optional(),
  }),
});

export const dashboardSummarySchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const hospitalParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});
