import { Router } from 'express';

import { authenticate, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { scanRateLimiter } from '../middleware/security.js';
import { uploadPhoneScanImage } from '../middleware/upload.js';
import * as scansController from '../controllers/scans.controller.js';
import { listScanBatchesSchema, scanBatchParamsSchema } from '../schemas/scan.schema.js';

const router = Router();

router.use(authenticate);

// เว็บ (web.phone.history.view) กับมือถือ (handheld.phone.scan.*) เป็นสิทธิ์คนละชุดที่แอดมิน
// เปิด/ปิดแยกกันได้ — endpoint เดียวกันนี้ถูกเรียกจากทั้งสองช่องทาง จึงยอมผ่านถ้ามีสิทธิ์ฝั่งใดฝั่งหนึ่ง
router.get(
  '/',
  requireAnyPermission('web.phone.history.view', 'handheld.phone.scan.view'),
  validateRequest(listScanBatchesSchema),
  scansController.listScanBatches
);
router.post(
  '/',
  requireAnyPermission('web.phone.scan.edit', 'handheld.phone.scan.edit'),
  scanRateLimiter,
  uploadPhoneScanImage,
  scansController.createScan
);
router.get(
  '/:id',
  requireAnyPermission('web.phone.history.view', 'handheld.phone.scan.view'),
  validateRequest(scanBatchParamsSchema),
  scansController.getScanBatch
);

export default router;
