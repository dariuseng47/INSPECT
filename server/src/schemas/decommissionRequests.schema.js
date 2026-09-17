import { z } from 'zod';

export const listDecommissionRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const decommissionRequestParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const rejectDecommissionRequestSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    reviewNote: z.string().max(255).optional(),
  }),
});
