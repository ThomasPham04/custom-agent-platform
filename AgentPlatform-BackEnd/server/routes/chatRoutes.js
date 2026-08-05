import { Router } from 'express';
import { createMessage } from '../controllers/chatController.js';

const router = Router();

router.post('/:agentId/messages', createMessage);

export default router;
