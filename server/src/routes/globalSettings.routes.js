import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as globalSettingsController from '../controllers/globalSettings.controller.js';
import { updateGlobalSettingsSchema } from '../schemas/globalSettings.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', globalSettingsController.getSettings);
router.put('/', validateRequest(updateGlobalSettingsSchema), globalSettingsController.updateSettings);

export default router;
