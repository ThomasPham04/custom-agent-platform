import { TOOLS } from '../data/tools.js';
import { ok } from '../utils/status.js';

export const listTools = (_req, res) => ok(res, TOOLS);
