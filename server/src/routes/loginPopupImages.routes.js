import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { uploadLoginPopupImage } from '../middleware/upload.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as loginPopupImagesController from '../controllers/loginPopupImages.controller.js';
import {
  createLoginPopupImageSchema,
  updateLoginPopupImageSchema,
  deleteLoginPopupImageSchema,
} from '../schemas/loginPopupImages.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', loginPopupImagesController.listAll);
router.get('/for-me', loginPopupImagesController.listForMe);
router.post(
  '/',
  uploadLoginPopupImage,
  validateRequest(createLoginPopupImageSchema),
  loginPopupImagesController.create
);
router.patch(
  '/:id',
  uploadLoginPopupImage,
  validateRequest(updateLoginPopupImageSchema),
  loginPopupImagesController.update
);
router.delete('/:id', validateRequest(deleteLoginPopupImageSchema), loginPopupImagesController.remove);

export default router;
