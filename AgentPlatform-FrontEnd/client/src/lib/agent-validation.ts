import type { AgentDraft } from '../types/agent';

/**
 * The fields an agent cannot be saved without. The server accepts a blank name
 * or system prompt — it only bounds their length — so this is a product rule the
 * client enforces at the one place agents are composed, not a mirror of
 * `agents/validation.py`.
 */
export const REQUIRED_AGENT_FIELDS = ['name', 'status', 'model', 'systemPrompt'] as const;

export type RequiredAgentField = (typeof REQUIRED_AGENT_FIELDS)[number];

export type AgentFieldErrors = Partial<Record<RequiredAgentField, string>>;

const MESSAGES: Record<RequiredAgentField, string> = {
  name: 'Name is required.',
  status: 'Status is required.',
  model: 'Model is required.',
  systemPrompt: 'System prompt is required.',
};

/** Whitespace alone is not a value: " " in the name field is still a blank. */
const missing = (value: string) => value.trim().length === 0;

export const validateAgent = (
  agent: Pick<AgentDraft, RequiredAgentField>,
): AgentFieldErrors => {
  const errors: AgentFieldErrors = {};
  for (const field of REQUIRED_AGENT_FIELDS) {
    if (missing(agent[field])) errors[field] = MESSAGES[field];
  }
  return errors;
};

export const hasFieldErrors = (errors: AgentFieldErrors) => Object.keys(errors).length > 0;
