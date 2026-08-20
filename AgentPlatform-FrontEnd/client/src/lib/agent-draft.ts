import { DEFAULT_MODEL } from '../config/models';
import type { AgentDraft } from '../types/agent';

/**
 * The starting point for a new agent, composed on the client.
 *
 * Defaults are duplicated from the server so the UI can render immediately
 * without creating a row: the panel needs something the moment "New agent" is
 * clicked, but fetching defaults from the server would create the agent.
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
