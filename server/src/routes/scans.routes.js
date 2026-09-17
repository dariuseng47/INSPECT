import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { uploadPhoneScanImage } from '../middleware/upload.js';
import * as scansController from '../controllers/scans.controller.js';
import { listScanBatchesSchema, scanBatchParamsSchema } from '../schemas/scan.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.phone.history.view'),
  validateRequest(listScanBatchesSchema),
  scansController.listScanBatches
);
router.post('/', requirePermission('web.phone.scan.edit'), uploadPhoneScanImage, scansController.createScan);
router.get(
  '/:id',
  requirePermission('web.phone.history.view'),
  validateRequest(scanBatchParamsSchema),
  scansController.getScanBatch
);

export default router;
