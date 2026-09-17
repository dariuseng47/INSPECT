import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as alertsController from '../controllers/alerts.controller.js';
import { listAlertsSchema } from '../schemas/alerts.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.alerts.view'),
  validateRequest(listAlertsSchema),
  alertsController.listAlerts
);

export default router;
