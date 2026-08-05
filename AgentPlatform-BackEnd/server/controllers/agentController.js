import * as store from '../services/agentStore.js';
import { created, noContent, notFound, ok } from '../utils/status.js';

export const listAgents = (_req, res) => ok(res, store.listAgents());

export const getAgent = (req, res, next) => {
  const agent = store.getAgent(req.params.id);
  if (!agent) return next(notFound(`No agent with id "${req.params.id}".`));
  return ok(res, agent);
};

export const createAgent = (req, res, next) => {
  try {
    return created(res, store.createAgent(req.body));
  } catch (error) {
    return next(error);
  }
};

export const updateAgent = (req, res, next) => {
  try {
    const agent = store.updateAgent(req.params.id, req.body);
    if (!agent) return next(notFound(`No agent with id "${req.params.id}".`));
    return ok(res, agent);
  } catch (error) {
    return next(error);
  }
};

export const deleteAgent = (req, res, next) => {
  if (!store.deleteAgent(req.params.id)) {
    return next(notFound(`No agent with id "${req.params.id}".`));
  }
  return noContent(res);
};
