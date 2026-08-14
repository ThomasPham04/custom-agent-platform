export type AgentStatus = 'active' | 'draft';

export interface Agent {
  id: string;
  name: string;
  /** Single emoji, one of AGENT_ICONS. */
  icon: string;
  description: string;
  model: string;
  systemPrompt: string;
  toolIds: string[];
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
}

/** The fields a client may write. id and the timestamps are server-owned. */
export type AgentPatch = Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * An agent being composed in the panel that the server has never seen. It has
 * no id and no timestamps because nothing has been created yet — that is the
 * whole point of the type, and why it cannot simply be an Agent with blanks.
 */
export type AgentDraft = Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>;
