import { z } from 'zod';

export const listCabinetsSchema = z.object({
  query: z.object({
    hospitalId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
  }),
});

export const createCabinetSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(150),
    departmentId: z.coerce.number().int().positive(),
  }),
});

export const updateCabinetSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
  }),
});

export const cabinetParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

export const upsertParLevelsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    parLevels: z
      .array(
        z.object({
          fabricCategoryId: z.coerce.number().int().positive(),
          parLevelQty: z.coerce.number().int().nonnegative(),
          warningPct: z.coerce.number().int().min(0).max(100).optional(),
        })
      )
      .min(1),
  }),
});
