import { Router } from 'express';

import { authenticate, requirePermission, requireAnyPermission } from '../middleware/authenticate.js';
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

// list ยอมทั้งแอดมิน (จัดการรุ่น) และโอเปอเรเตอร์ผ่านมือถือ (ต้องอ่านรายชื่อรุ่นเพื่อเลือกตอน
// ยืนยันเครื่องที่ไม่แน่ใจ) — write ทุก endpoint ที่เหลือด้านล่างยังคง admin-only เหมือนเดิม
router.get(
  '/',
  requireAnyPermission('web.phone.models.view', 'handheld.phone.scan.edit'),
  phoneModelsController.listPhoneModels
);

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
