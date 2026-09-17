import { z } from 'zod';

export const listQueueSchema = z.object({
  query: z.object({
    status: z.enum(['pending', 'resolved', 'new_model_created']).optional(),
  }),
});

export const queueParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
});

// resolve: เลือกรุ่นที่มีอยู่แล้ว (resolvedModelId) หรือสร้างรุ่นใหม่ (newModel) — อย่างใดอย่างหนึ่ง
export const resolveQueueSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z
    .object({
      resolvedModelId: z.coerce.number().int().positive().optional(),
      newModel: z
        .object({
          brand: z.string().min(1).max(100),
          modelName: z.string().min(1).max(150),
          minCapacityGb: z.coerce.number().int().positive(),
        })
        .optional(),
      note: z.string().max(500).optional(),
    })
    .refine((v) => !!v.resolvedModelId !== !!v.newModel, {
      message: 'ต้องระบุ resolvedModelId หรือ newModel อย่างใดอย่างหนึ่งเท่านั้น',
    }),
});

export const rejectQueueSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({
    note: z.string().max(500).optional(),
  }),
});
