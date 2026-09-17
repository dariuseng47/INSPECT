import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getRestockReport } from '../controllers/restockReport.controller.js';
import { getRestockFillHistory } from '../controllers/restockFillHistory.controller.js';
import { getRestockReportSchema, getFillHistorySchema } from '../schemas/restockReport.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getRestockReportSchema),
  getRestockReport
);

router.get(
  '/fill-history',
  requirePermission('web.operations.restock_report.view'),
  validateRequest(getFillHistorySchema),
  getRestockFillHistory
);

export default router;
