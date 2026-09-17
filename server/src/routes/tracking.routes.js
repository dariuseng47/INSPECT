import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as trackingController from '../controllers/tracking.controller.js';
import { processStatusSchema, locationByEpcSchema } from '../schemas/tracking.schema.js';

const router = Router();

router.use(authenticate);

router.get('/location/:epc', validateRequest(locationByEpcSchema), trackingController.getLocationByEpc);
router.get('/process-status', validateRequest(processStatusSchema), trackingController.getProcessStatus);

export default router;
