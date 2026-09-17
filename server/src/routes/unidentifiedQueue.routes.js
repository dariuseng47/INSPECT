import { Router } from 'express';

import { authenticate, requirePermission, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { uploadPhoneModelImages } from '../middleware/upload.js';
import * as queueController from '../controllers/unidentifiedQueue.controller.js';
import { listQueueSchema, queueParamsSchema, resolveQueueSchema, rejectQueueSchema } from '../schemas/unidentifiedQueue.schema.js';

const router = Router();

router.use(authenticate);

// list เต็มรูปแบบ (ทุกรายการทุกคน) เป็นมุมมองแอดมินเท่านั้น — มือถือไม่ต้องเรียกนี้ เพราะได้
// candidate_model_ids ติดมากับผลสแกน (GET/POST /scans) ของตัวเองอยู่แล้ว
router.get('/', requirePermission('web.phone.queue.view'), validateRequest(listQueueSchema), queueController.listQueue);

// resolve/reject/extra-images ยอมทั้งแอดมิน (web.phone.queue.edit, จัดการได้ทุกรายการ) และโอเปอเรเตอร์
// ผ่านมือถือ (handheld.phone.scan.edit, จัดการได้เฉพาะรายการจากการสแกนของตัวเอง — เช็คใน controller)
router.post(
  '/:id/extra-images',
  requireAnyPermission('web.phone.queue.edit', 'handheld.phone.scan.edit'),
  validateRequest(queueParamsSchema),
  uploadPhoneModelImages,
  queueController.addExtraImages
);

router.put(
  '/:id/resolve',
  requireAnyPermission('web.phone.queue.edit', 'handheld.phone.scan.edit'),
  validateRequest(resolveQueueSchema),
  queueController.resolveQueue
);

router.put(
  '/:id/reject',
  requireAnyPermission('web.phone.queue.edit', 'handheld.phone.scan.edit'),
  validateRequest(rejectQueueSchema),
  queueController.rejectQueue
);

export default router;
