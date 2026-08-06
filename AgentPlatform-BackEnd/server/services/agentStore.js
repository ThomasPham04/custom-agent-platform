import { AGENT_DEFAULTS, MODEL_IDS, SEED_AGENTS } from '../data/agents.js';
import { TOOLS } from '../data/tools.js';
import { badRequest } from '../utils/status.js';
import { createId } from '../utils/ids.js';

const agents = new Map();

const clone = (agent) => structuredClone(agent);

export const resetStore = () => {
  agents.clear();
  for (const agent of SEED_AGENTS) agents.set(agent.id, clone(agent));
};

resetStore();

const WRITABLE = ['name', 'icon', 'description', 'model', 'systemPrompt', 'toolIds', 'status'];

const STRING_LIMITS = {
  name: 120,
  icon: 32,
  description: 2000,
  model: 64,
  systemPrompt: 20000,
  status: 16,
};

const isObjectBody = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validate = (patch) => {
  for (const [field, limit] of Object.entries(STRING_LIMITS)) {
    if (patch[field] === undefined) continue;
    if (typeof patch[field] !== 'string') throw badRequest(`${field} must be a string.`);
    if (patch[field].length > limit) {
      throw badRequest(`${field} must be at most ${limit} characters.`);
    }
  }
  if (patch.model !== undefined && !MODEL_IDS.includes(patch.model)) {
    throw badRequest(`Unknown model "${patch.model}".`);
  }
  if (patch.status !== undefined && !['active', 'draft'].includes(patch.status)) {
    throw badRequest(`Unknown status "${patch.status}".`);
  }
  if (patch.toolIds !== undefined) {
    if (!Array.isArray(patch.toolIds)) throw badRequest('toolIds must be an array.');
    if (!patch.toolIds.every((id) => typeof id === 'string')) {
      throw badRequest('toolIds must contain only strings.');
    }
    if (patch.toolIds.length > TOOLS.length) {
      throw badRequest(`toolIds must contain at most ${TOOLS.length} items.`);
    }
    if (new Set(patch.toolIds).size !== patch.toolIds.length) {
      throw badRequest('toolIds must not contain duplicates.');
    }
    const known = new Set(TOOLS.map((tool) => tool.id));
    const unknown = patch.toolIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw badRequest(`Unknown tool ids: ${unknown.join(', ')}.`);
  }
};

// Drops keys the client must not set (id, createdAt, updatedAt) and undefined values.
const pickWritable = (input) => {
  if (input === undefined) return {};
  if (!isObjectBody(input)) throw badRequest('Request body must be a JSON object.');
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) => WRITABLE.includes(key) && value !== undefined,
    ),
  );
};

export const listAgents = () =>
  [...agents.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);

export const getAgent = (id) => {
  const agent = agents.get(id);
  return agent ? clone(agent) : undefined;
};

export const createAgent = (input) => {
  const patch = pickWritable(input);
  validate(patch);
  const now = new Date().toISOString();
  const agent = {
    ...AGENT_DEFAULTS,
    ...patch,
    id: createId('agent'),
    createdAt: now,
    updatedAt: now,
  };
  agents.set(agent.id, agent);
  return clone(agent);
};

export const updateAgent = (id, input) => {
  const existing = agents.get(id);
  if (!existing) return undefined;
  const patch = pickWritable(input);
  validate(patch);
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  agents.set(id, updated);
  return clone(updated);
};

export const deleteAgent = (id) => agents.delete(id);
