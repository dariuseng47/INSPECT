import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as cabinetsController from '../controllers/cabinets.controller.js';
import {
  cabinetParamsSchema,
  createCabinetSchema,
  listCabinetsSchema,
  updateCabinetSchema,
  upsertParLevelsSchema,
} from '../schemas/cabinet.schema.js';

const router = Router();

router.use(authenticate);

// GET เปิดให้ผู้ใช้ที่ผ่าน auth ทุกคน (nativeapp ward ใช้เลือกตู้) — เขียนต้องมีสิทธิ์เมนูโครงสร้าง
router.get('/', validateRequest(listCabinetsSchema), cabinetsController.listCabinets);
router.post(
  '/',
  requirePermission('web.organization.edit'),
  validateRequest(createCabinetSchema),
  cabinetsController.createCabinet
);
router.patch(
  '/:id',
  requirePermission('web.organization.edit'),
  validateRequest(updateCabinetSchema),
  cabinetsController.updateCabinet
);
router.delete(
  '/:id',
  requirePermission('web.organization.edit'),
  validateRequest(cabinetParamsSchema),
  cabinetsController.deleteCabinet
);
router.get(
  '/:id/par-levels',
  validateRequest(cabinetParamsSchema),
  cabinetsController.getParLevels
);
router.put(
  '/:id/par-levels',
  requirePermission('web.organization.edit'),
  validateRequest(upsertParLevelsSchema),
  cabinetsController.upsertParLevels
);

export default router;
