import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getWashReceiveReport } from '../controllers/washReceiveReport.controller.js';
import { getWashReceiveReportSchema } from '../schemas/washReceiveReport.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.operations.wash_receive.view'),
  validateRequest(getWashReceiveReportSchema),
  getWashReceiveReport
);

export default router;
