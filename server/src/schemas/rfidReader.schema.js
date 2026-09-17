import { z } from 'zod';

export const scanCheckpointSchema = z.object({
  body: z.object({
    deviceId: z.coerce.number().int().positive(),
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});
