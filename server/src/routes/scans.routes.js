import { Router } from 'express';

import { authenticate, requireAnyPermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as scansController from '../controllers/scans.controller.js';
import * as stockScanController from '../controllers/stockScan.controller.js';
import { authenticateDevice } from '../middleware/authenticateDevice.js';
import {
  wardIssueSchema,
  stockScanSchema,
  weightGateSchema,
  wardReceiveSchema,
  bundleCheckSchema,
  cabinetAuditSchema,
  statusChangeSchema,
  washReceiveBatchSchema,
  listWardIssueRoundsSchema,
  listStockScanRoundsSchema,
} from '../schemas/scans.schema.js';

const router = Router();

// device token auth (ไม่ใช่ user JWT) ต้องมาก่อน router.use(authenticate) ด้านล่าง — edge device
// (WEIGHT_GATE/FOLDING_TABLE) ไม่มี user session ของตัวเอง ดู middleware/authenticateDevice.js
router.post(
  '/weight-gate',
  validateRequest(weightGateSchema),
  authenticateDevice,
  scansController.weightGate
);
router.post(
  '/bundle-check',
  validateRequest(bundleCheckSchema),
  authenticateDevice,
  scansController.bundleCheck
);

router.use(authenticate);

const wardEdit = requireAnyPermission('web.operations.ward.edit', 'handheld.ward.edit');

router.post('/ward-issue', wardEdit, validateRequest(wardIssueSchema), scansController.wardIssue);
router.post('/ward-receive', wardEdit, validateRequest(wardReceiveSchema), scansController.wardReceive);
router.post('/cabinet-audit', wardEdit, validateRequest(cabinetAuditSchema), scansController.cabinetAudit);
router.post(
  '/status-change',
  requireAnyPermission('web.fabric.inventory.edit', 'handheld.status_change.edit'),
  validateRequest(statusChangeSchema),
  scansController.statusChange
);
router.post(
  '/wash-receive-batch',
  requireAnyPermission('web.operations.wash_receive.edit'),
  validateRequest(washReceiveBatchSchema),
  scansController.washReceiveBatch
);
router.get(
  '/ward-issue-rounds',
  validateRequest(listWardIssueRoundsSchema),
  scansController.listWardIssueRounds
);
router.post(
  '/stock-scan',
  requireAnyPermission('web.operations.stock_scan.edit'),
  validateRequest(stockScanSchema),
  stockScanController.stockScan
);
router.get(
  '/stock-scan-rounds',
  validateRequest(listStockScanRoundsSchema),
  stockScanController.listStockScanRounds
);

export default router;
