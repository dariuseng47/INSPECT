import { Router } from 'express';

import { authenticate, requirePermission } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as auditLogsController from '../controllers/auditLogs.controller.js';
import { listAuditLogsSchema } from '../schemas/auditLog.schema.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('web.security.audit_logs.view'),
  validateRequest(listAuditLogsSchema),
  auditLogsController.listAuditLogs
);

export default router;
