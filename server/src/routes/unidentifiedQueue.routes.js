import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { uploadPhoneModelImages } from '../middleware/upload.js';
import * as queueController from '../controllers/unidentifiedQueue.controller.js';
import { listQueueSchema, queueParamsSchema, resolveQueueSchema, rejectQueueSchema } from '../schemas/unidentifiedQueue.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('web.phone.queue.view'), validateRequest(listQueueSchema), queueController.listQueue);

router.post(
  '/:id/extra-images',
  requirePermission('web.phone.queue.edit'),
  validateRequest(queueParamsSchema),
  uploadPhoneModelImages,
  queueController.addExtraImages
);

router.put(
  '/:id/resolve',
  requirePermission('web.phone.queue.edit'),
  validateRequest(resolveQueueSchema),
  queueController.resolveQueue
);

router.put(
  '/:id/reject',
  requirePermission('web.phone.queue.edit'),
  validateRequest(rejectQueueSchema),
  queueController.rejectQueue
);

export default router;
