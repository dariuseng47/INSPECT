import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as statusTimeoutsController from '../controllers/statusTimeouts.controller.js';
import {
  listStatusTimeoutsSchema,
  upsertStatusTimeoutsSchema,
} from '../schemas/statusTimeout.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.security.timeouts.view'),
  validateRequest(listStatusTimeoutsSchema),
  statusTimeoutsController.listStatusTimeouts
);
router.put(
  '/',
  requirePermission('web.security.timeouts.edit'),
  validateRequest(upsertStatusTimeoutsSchema),
  statusTimeoutsController.upsertStatusTimeouts
);

export default router;
