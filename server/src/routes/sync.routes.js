import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as syncConflictsController from '../controllers/syncConflicts.controller.js';
import {
  syncBatchSchema,
  listConflictsSchema,
  approveConflictSchema,
} from '../schemas/sync.schema.js';

const router = Router();

router.use(authenticate);

// /batch = อัปโหลด scan ที่ค้างจากออฟไลน์ของ nativeapp — ไม่ gate ด้วยสิทธิ์เมนูเว็บ
router.post('/batch', validateRequest(syncBatchSchema), syncConflictsController.syncBatch);
router.get(
  '/conflicts',
  requirePermission('web.security.sync_conflicts.view'),
  validateRequest(listConflictsSchema),
  syncConflictsController.listConflicts
);
router.post(
  '/conflicts/:id/approve',
  requirePermission('web.security.sync_conflicts.edit'),
  validateRequest(approveConflictSchema),
  syncConflictsController.approveConflict
);

export default router;
