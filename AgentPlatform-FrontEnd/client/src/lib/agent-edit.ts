import type { Agent, AgentPatch } from '../types/agent';

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index]);

export const agentPatch = (baseline: Agent, edited: Agent): AgentPatch => {
  const patch: AgentPatch = {};
  if (baseline.name !== edited.name) patch.name = edited.name;
  if (baseline.icon !== edited.icon) patch.icon = edited.icon;
  if (baseline.description !== edited.description) patch.description = edited.description;
  if (baseline.model !== edited.model) patch.model = edited.model;
  if (baseline.systemPrompt !== edited.systemPrompt) patch.systemPrompt = edited.systemPrompt;
  if (!sameIds(baseline.toolIds, edited.toolIds)) patch.toolIds = [...edited.toolIds];
  if (baseline.status !== edited.status) patch.status = edited.status;
  return patch;
};

export const hasAgentChanges = (baseline: Agent, edited: Agent) =>
  Object.keys(agentPatch(baseline, edited)).length > 0;
