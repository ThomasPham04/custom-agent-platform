import { getAgent } from '../services/agentStore.js';
import { executeAgent } from '../services/mockExecutionService.js';
import { badRequest, notFound, ok } from '../utils/status.js';

export const createMessage = (req, res, next) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) return next(notFound(`No agent with id "${req.params.agentId}".`));

  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (content.length === 0) return next(badRequest('A message needs some content.'));

  // Retry is explicit request metadata, not process-global server state. This
  // keeps identical messages from different clients independent.
  const retry = req.body?.retry === true;
  return ok(res, { message: executeAgent(agent, content, { retry }) });
};
