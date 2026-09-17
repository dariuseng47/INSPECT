import { z } from 'zod';

export const updateGlobalSettingsSchema = z.object({
  body: z.object({
    defaultRssiThresholdDbm: z.coerce.number().int().max(0).optional(),
    defaultParLevelWarningPct: z.coerce.number().int().min(0).max(100).optional(),
  }),
});
