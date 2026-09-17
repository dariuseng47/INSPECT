import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as decommissionRequestsController from '../controllers/decommissionRequests.controller.js';
import {
  listDecommissionRequestsSchema,
  decommissionRequestParamsSchema,
  rejectDecommissionRequestSchema,
} from '../schemas/decommissionRequests.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validateRequest(listDecommissionRequestsSchema),
  decommissionRequestsController.listDecommissionRequests
);
router.post(
  '/:id/approve',
  validateRequest(decommissionRequestParamsSchema),
  decommissionRequestsController.approveDecommissionRequest
);
router.post(
  '/:id/reject',
  validateRequest(rejectDecommissionRequestSchema),
  decommissionRequestsController.rejectDecommissionRequest
);

export default router;
