import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as usersController from '../controllers/users.controller.js';
import * as permissionsController from '../controllers/permissions.controller.js';
import {
  createUserSchema,
  listUsersSchema,
  updateUserSchema,
  userPermissionsParamsSchema,
  updateUserPermissionsSchema,
} from '../schemas/user.schema.js';

const router = Router();

router.use(authenticate);

// ต้องอยู่ก่อน '/' และ '/:id/*' — endpoint ส่วนตัวของผู้ใช้เอง ไม่ผูกกับสิทธิ์เมนู "ผู้ใช้งาน"
router.get('/me/permissions', permissionsController.getMyPermissions);
router.get('/me/hospitals', usersController.getMyHospitals);

router.get(
  '/',
  requirePermission('web.security.users.view'),
  validateRequest(listUsersSchema),
  usersController.listUsers
);
router.post(
  '/',
  requirePermission('web.security.users.edit'),
  validateRequest(createUserSchema),
  usersController.createUser
);
router.patch(
  '/:id',
  requirePermission('web.security.users.edit'),
  validateRequest(updateUserSchema),
  usersController.updateUser
);
router.delete('/:id', requirePermission('web.security.users.edit'), usersController.deleteUser);

router.get(
  '/:id/permissions',
  requirePermission('web.security.users.view'),
  validateRequest(userPermissionsParamsSchema),
  permissionsController.getUserPermissions
);
router.put(
  '/:id/permissions',
  requirePermission('web.security.users.edit'),
  validateRequest(updateUserPermissionsSchema),
  permissionsController.updateUserPermissions
);

export default router;
