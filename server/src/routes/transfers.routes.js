import { Router } from 'express';

import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import * as transfersController from '../controllers/transfers.controller.js';
import { listTransfersSchema, createTransferSchema } from '../schemas/transfer.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', validateRequest(listTransfersSchema), transfersController.listTransfers);
router.post('/', validateRequest(createTransferSchema), transfersController.createTransfer);

export default router;
