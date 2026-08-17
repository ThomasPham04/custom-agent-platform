import { describe, expect, it } from 'vitest';
import { agentPatch, hasAgentChanges } from './agent-edit';
import type { Agent } from '../types/agent';

const baseline: Agent = {
  id: 'agent_support',
  name: 'Support Bot',
  icon: 'A',
  description: 'Answers questions.',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be helpful.',
  toolIds: ['current_time'],
  status: 'active',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-04T10:00:00.000Z',
};

describe('agentPatch', () => {
  it('returns no fields for an unchanged copy', () => {
    expect(agentPatch(baseline, { ...baseline, toolIds: [...baseline.toolIds] })).toEqual({});
    expect(hasAgentChanges(baseline, { ...baseline })).toBe(false);
  });

  it('returns only changed writable fields', () => {
    const edited = { ...baseline, name: 'Renamed', toolIds: ['current_time', 'calculator'] };
    expect(agentPatch(baseline, edited)).toEqual({
      name: 'Renamed',
      toolIds: ['current_time', 'calculator'],
    });
    expect(hasAgentChanges(baseline, edited)).toBe(true);
  });

  it('ignores server-owned fields', () => {
    expect(agentPatch(baseline, { ...baseline, updatedAt: 'later' })).toEqual({});
  });

  it('covers every writable field', () => {
    const edited: Agent = {
      ...baseline,
      name: 'Renamed',
      icon: 'B',
      description: 'Changed.',
      model: 'another-model',
      systemPrompt: 'Changed prompt.',
      toolIds: ['calculator'],
      status: 'draft',
    };
    expect(agentPatch(baseline, edited)).toEqual({
      name: 'Renamed',
      icon: 'B',
      description: 'Changed.',
      model: 'another-model',
      systemPrompt: 'Changed prompt.',
      toolIds: ['calculator'],
      status: 'draft',
    });
  });
});
