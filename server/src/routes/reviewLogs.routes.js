import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import * as reviewLogsController from '../controllers/reviewLogs.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('web.phone.queue.view'), reviewLogsController.listReviewLogs);

export default router;
