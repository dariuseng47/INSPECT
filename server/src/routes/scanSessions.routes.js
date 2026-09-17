import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as scanSessionsController from '../controllers/scanSessions.controller.js';
import {
  confirmScanSessionSchema,
  listScanSessionsSchema,
  reportScanSessionSchema,
  scanSessionParamsSchema,
  triggerScanSessionSchema,
} from '../schemas/scanSession.schema.js';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(triggerScanSessionSchema), scanSessionsController.triggerScanSession);
router.get('/', validateRequest(listScanSessionsSchema), scanSessionsController.listScanSessions);
router.get('/:id', validateRequest(scanSessionParamsSchema), scanSessionsController.getScanSession);
router.post(
  '/:id/report',
  validateRequest(reportScanSessionSchema),
  scanSessionsController.reportScanSession
);
router.post(
  '/:id/confirm',
  validateRequest(confirmScanSessionSchema),
  scanSessionsController.confirmScanSession
);
router.post(
  '/:id/cancel',
  validateRequest(scanSessionParamsSchema),
  scanSessionsController.cancelScanSession
);

export default router;
