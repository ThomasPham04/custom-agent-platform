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
