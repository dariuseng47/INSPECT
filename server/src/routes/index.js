import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import auditLogsRoutes from './auditLogs.routes.js';
import loginPopupImagesRoutes from './loginPopupImages.routes.js';
import phoneModelsRoutes from './phoneModels.routes.js';
import scansRoutes from './scans.routes.js';
import unidentifiedQueueRoutes from './unidentifiedQueue.routes.js';
import reviewLogsRoutes from './reviewLogs.routes.js';
import mlHealthRoutes from './mlHealth.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/login-popup-images', loginPopupImagesRoutes);
router.use('/phone-models', phoneModelsRoutes);
router.use('/scans', scansRoutes);
router.use('/unidentified-queue', unidentifiedQueueRoutes);
router.use('/review-logs', reviewLogsRoutes);
router.use('/ml-health', mlHealthRoutes);

export default router;
