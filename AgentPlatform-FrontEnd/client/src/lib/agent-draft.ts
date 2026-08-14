import { DEFAULT_MODEL } from '../config/models';
import type { AgentDraft } from '../types/agent';

/**
 * The starting point for a new agent, composed on the client.
 *
 * Mirrors AGENT_DEFAULTS in app/modules/agents/seeds.py — change both together.
 * Duplicating them is the price of not writing a row before the person has
 * decided to keep one: the panel needs something to render the moment "New
 * agent" is clicked, and asking the server for it would create the agent.
 */
export const newAgentDraft = (): AgentDraft => ({
  name: 'New agent',
  icon: '🧩',
  description: '',
  model: DEFAULT_MODEL,
  systemPrompt: '',
  toolIds: [],
  status: 'draft',
});
