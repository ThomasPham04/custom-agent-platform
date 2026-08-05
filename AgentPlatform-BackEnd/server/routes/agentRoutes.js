import { Router } from 'express';
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  updateAgent,
} from '../controllers/agentController.js';

const router = Router();

router.get('/', listAgents);
router.post('/', createAgent);
router.get('/:id', getAgent);
router.patch('/:id', updateAgent);
router.delete('/:id', deleteAgent);

export default router;
