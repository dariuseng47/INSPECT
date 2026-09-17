import { z } from 'zod';

export const createPhoneModelSchema = z.object({
  body: z.object({
    brand: z.string().min(1).max(100),
    modelName: z.string().min(1).max(150),
    minCapacityGb: z.coerce.number().int().positive(),
  }),
});

export const updatePhoneModelSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    brand: z.string().min(1).max(100).optional(),
    modelName: z.string().min(1).max(150).optional(),
    minCapacityGb: z.coerce.number().int().positive().optional(),
    coverImageId: z.coerce.number().int().positive().optional(),
  }),
});

export const phoneModelParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const uploadPhoneModelImagesSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const deletePhoneModelImageSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    imageId: z.coerce.number().int().positive(),
  }),
});
