import { z } from 'zod';

export const listAuditLogsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    action: z.string().max(50).optional(),
    limit: z.coerce.number().int().positive().max(500).optional(),
  }),
});
