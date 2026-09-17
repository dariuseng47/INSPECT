import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter, refreshRateLimiter, pinLoginRateLimiter } from '../middleware/security.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginSchema, refreshSchema, loginPinSchema } from '../schemas/auth.schema.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', authRateLimiter, validateRequest(loginSchema), authController.login);
router.post(
  '/login-pin',
  pinLoginRateLimiter,
  validateRequest(loginPinSchema),
  authController.loginPin
);
router.post('/refresh', refreshRateLimiter, validateRequest(refreshSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
