import { z } from 'zod';

export const listTransfersSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
  }),
});

export const createTransferSchema = z.object({
  body: z.object({
    epcCode: z.string().min(1),
    toHospitalId: z.coerce.number().int().positive(),
    toCategoryId: z.coerce.number().int().positive(),
  }),
});
