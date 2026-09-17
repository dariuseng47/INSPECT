import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as rfidReaderController from '../controllers/rfidReader.controller.js';
import { scanCheckpointSchema } from '../schemas/rfidReader.schema.js';

const router = Router();

router.use(authenticate);

router.post('/scan', validateRequest(scanCheckpointSchema), rfidReaderController.scanCheckpoint);

export default router;
