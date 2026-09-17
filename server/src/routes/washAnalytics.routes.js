import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as washAnalyticsController from '../controllers/washAnalytics.controller.js';
import { getWashAnalyticsSchema } from '../schemas/washAnalytics.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.wash_analytics.view'),
  validateRequest(getWashAnalyticsSchema),
  washAnalyticsController.getWashAnalytics
);

export default router;
