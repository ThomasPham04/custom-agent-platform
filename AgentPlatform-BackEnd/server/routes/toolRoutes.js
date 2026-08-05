import { Router } from 'express';
import { listTools } from '../controllers/toolController.js';

const router = Router();

router.get('/', listTools);

export default router;
