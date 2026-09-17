import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getRestockCartPlan } from '../controllers/restockCartPlan.controller.js';
import { getRestockCartPlanSchema } from '../schemas/restockCartPlan.schema.js';

const router = Router();

router.use(authenticate);

// อยู่ในหน้า "รับ-ส่งผ้าประจำวอร์ด" (แท็บ "จัดผ้าเข้ารถ") — ใช้สิทธิ์เมนูเดียวกัน
router.get(
  '/',
  requirePermission('web.operations.ward.view'),
  validateRequest(getRestockCartPlanSchema),
  getRestockCartPlan
);

export default router;
