import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { uploadPhoneModelImages } from '../middleware/upload.js';
import * as phoneModelsController from '../controllers/phoneModels.controller.js';
import {
  createPhoneModelSchema,
  updatePhoneModelSchema,
  phoneModelParamsSchema,
  deletePhoneModelImageSchema,
} from '../schemas/phoneModel.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('web.phone.models.view'), phoneModelsController.listPhoneModels);

router.post('/reindex', requirePermission('web.phone.models.edit'), phoneModelsController.reindexAll);

router.get(
  '/:id',
  requirePermission('web.phone.models.view'),
  validateRequest(phoneModelParamsSchema),
  phoneModelsController.getPhoneModel
);
router.post(
  '/',
  requirePermission('web.phone.models.edit'),
  validateRequest(createPhoneModelSchema),
  phoneModelsController.createPhoneModel
);
router.patch(
  '/:id',
  requirePermission('web.phone.models.edit'),
  validateRequest(updatePhoneModelSchema),
  phoneModelsController.updatePhoneModel
);
router.delete(
  '/:id',
  requirePermission('web.phone.models.edit'),
  validateRequest(phoneModelParamsSchema),
  phoneModelsController.deletePhoneModel
);

router.post(
  '/:id/images',
  requirePermission('web.phone.models.edit'),
  validateRequest(phoneModelParamsSchema),
  uploadPhoneModelImages,
  phoneModelsController.uploadImages
);
router.delete(
  '/:id/images/:imageId',
  requirePermission('web.phone.models.edit'),
  validateRequest(deletePhoneModelImageSchema),
  phoneModelsController.deleteImage
);

export default router;
