import { Router } from 'express';

import { authenticate, requirePermission, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as devicesController from '../controllers/devices.controller.js';
import { authenticateDevice } from '../middleware/authenticateDevice.js';
import {
  createDeviceSchema,
  listDevicesSchema,
  updateDeviceSchema,
  heartbeatParamsSchema,
} from '../schemas/device.schema.js';

const router = Router();

// device token auth (ไม่ใช่ user JWT) ต้องมาก่อน router.use(authenticate) ด้านล่าง
// เพราะ edge device ไม่มี user session ของตัวเอง — ดู middleware/authenticateDevice.js
router.post(
  '/:id/heartbeat',
  validateRequest(heartbeatParamsSchema),
  authenticateDevice,
  devicesController.receiveHeartbeat
);

router.use(authenticate);

// GET เปิดให้ผู้ใช้ที่ผ่าน auth ทุกคน (nativeapp ใช้เลือกเครื่องอ่าน RFID)
router.get('/', validateRequest(listDevicesSchema), devicesController.listDevices);
router.post(
  '/',
  requirePermission('web.devices.edit'),
  validateRequest(createDeviceSchema),
  devicesController.createDevice
);
// PATCH: ผ่านได้ถ้ามีสิทธิ์แก้ config อุปกรณ์ หรือแก้แค่ข้อมูลผู้ดูแล — controller แยกต่ออีกชั้น
router.patch(
  '/:id',
  requireAnyPermission('web.devices.edit', 'web.devices.caretaker.edit'),
  validateRequest(updateDeviceSchema),
  devicesController.updateDevice
);
router.delete(
  '/:id',
  requirePermission('web.devices.edit'),
  validateRequest(heartbeatParamsSchema),
  devicesController.deleteDevice
);
router.post(
  '/:id/rotate-token',
  requirePermission('web.devices.edit'),
  validateRequest(heartbeatParamsSchema),
  devicesController.rotateDeviceToken
);

export default router;
