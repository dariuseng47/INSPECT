import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as departmentsController from '../controllers/departments.controller.js';
import {
  createDepartmentSchema,
  departmentParamsSchema,
  listDepartmentsSchema,
  updateDepartmentSchema,
} from '../schemas/department.schema.js';

const router = Router();

router.use(authenticate);

// GET เปิดให้ผู้ใช้ที่ผ่าน auth ทุกคน (nativeapp ward/inventory ใช้เลือกแผนก) — เขียนต้องมีสิทธิ์เมนูโครงสร้าง
router.get('/', validateRequest(listDepartmentsSchema), departmentsController.listDepartments);
router.post(
  '/',
  requirePermission('web.organization.edit'),
  validateRequest(createDepartmentSchema),
  departmentsController.createDepartment
);
router.patch(
  '/:id',
  requirePermission('web.organization.edit'),
  validateRequest(updateDepartmentSchema),
  departmentsController.updateDepartment
);
router.delete(
  '/:id',
  requirePermission('web.organization.edit'),
  validateRequest(departmentParamsSchema),
  departmentsController.deleteDepartment
);

export default router;
