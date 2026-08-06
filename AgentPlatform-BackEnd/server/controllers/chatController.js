import { getAgent } from '../services/agentStore.js';
import { executeAgent } from '../services/mockExecutionService.js';
import { badRequest, notFound, ok } from '../utils/status.js';

export const createMessage = (req, res, next) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) return next(notFound(`No agent with id "${req.params.agentId}".`));

  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return next(badRequest('Request body must be a JSON object.'));
  }
  if (req.body.content !== undefined && typeof req.body.content !== 'string') {
    return next(badRequest('content must be a string.'));
  }
  if (req.body.retry !== undefined && typeof req.body.retry !== 'boolean') {
    return next(badRequest('retry must be a boolean.'));
  }

  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (content.length === 0) return next(badRequest('A message needs some content.'));
  if (content.length > 10000) return next(badRequest('content must be at most 10000 characters.'));

  // Retry is explicit request metadata, not process-global server state. This
  // keeps identical messages from different clients independent.
  const retry = req.body.retry === true;
  return ok(res, { message: executeAgent(agent, content, { retry }) });
};
