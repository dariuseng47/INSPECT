import { Router } from 'express';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import scansRoutes from './scans.routes.js';
import fabricRoutes from './fabric.routes.js';
import devicesRoutes from './devices.routes.js';
import cabinetsRoutes from './cabinets.routes.js';
import trackingRoutes from './tracking.routes.js';
import hospitalsRoutes from './hospitals.routes.js';
import departmentsRoutes from './departments.routes.js';
import scanSessionsRoutes from './scanSessions.routes.js';
import auditLogsRoutes from './auditLogs.routes.js';
import statusTimeoutsRoutes from './statusTimeouts.routes.js';
import alertsRoutes from './alerts.routes.js';
import washAnalyticsRoutes from './washAnalytics.routes.js';
import globalSettingsRoutes from './globalSettings.routes.js';
import transfersRoutes from './transfers.routes.js';
import syncRoutes from './sync.routes.js';
import rfidReaderRoutes from './rfidReader.routes.js';
import restockReportRoutes from './restockReport.routes.js';
import restockCartPlanRoutes from './restockCartPlan.routes.js';
import decommissionRequestsRoutes from './decommissionRequests.routes.js';
import washReceiveReportRoutes from './washReceiveReport.routes.js';
import loginPopupImagesRoutes from './loginPopupImages.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/hospitals', hospitalsRoutes);
router.use('/users', usersRoutes);
router.use('/devices', devicesRoutes);
router.use('/scan-sessions', scanSessionsRoutes);
router.use('/scans', scansRoutes);
router.use('/tracking', trackingRoutes);
router.use('/departments', departmentsRoutes);
router.use('/cabinets', cabinetsRoutes);
router.use('/audit-logs', auditLogsRoutes);
router.use('/status-timeout-settings', statusTimeoutsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/wash-analytics', washAnalyticsRoutes);
router.use('/global-settings', globalSettingsRoutes);
router.use('/transfers', transfersRoutes);
router.use('/sync', syncRoutes);
router.use('/rfid-reader', rfidReaderRoutes);
router.use('/restock-report', restockReportRoutes);
router.use('/restock-cart-plan', restockCartPlanRoutes);
router.use('/decommission-requests', decommissionRequestsRoutes);
router.use('/wash-receive-report', washReceiveReportRoutes);
router.use('/login-popup-images', loginPopupImagesRoutes);

// fabricRoutes mount ที่ '/' (root) เพราะ endpoint จริงเป็น path แบนๆ เช่น /fabric-items,
// /fabric-lots ไม่ใช่ /fabric/items — ต้อง mount เป็นตัวสุดท้ายเสมอ ไม่งั้น router.use(authenticate)
// ข้างในมันจะดัก request ของทุก path ที่ mount มาก่อนหน้านี้ (เพราะ '/' match ทุก path เป็น prefix)
// ก่อนที่ request จะไปถึง route จริงของมันเอง — เจอบั๊กนี้ตอนเพิ่ม device-token route ที่ไม่ผ่าน
// user JWT (/devices/:id/heartbeat) แล้วดันโดน fabricRoutes ดักด้วย authenticate ก่อนเสมอ
router.use('/', fabricRoutes);

export default router;
