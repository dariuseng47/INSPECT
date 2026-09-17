import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import auditLogsRoutes from './auditLogs.routes.js';
import loginPopupImagesRoutes from './loginPopupImages.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/login-popup-images', loginPopupImagesRoutes);

export default router;
