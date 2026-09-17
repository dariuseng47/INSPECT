import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import * as mlHealthController from '../controllers/mlHealth.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', mlHealthController.getMlHealth);

export default router;
