import { describe, expect, it } from 'vitest';
import { hasFieldErrors, validateAgent } from './agent-validation';
import type { AgentDraft } from '../types/agent';

const draft = (over: Partial<AgentDraft> = {}): AgentDraft => ({
  name: 'Support Bot',
  icon: '🎧',
  description: '',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be terse.',
  toolIds: [],
  status: 'draft',
  ...over,
});

describe('validateAgent', () => {
  it('accepts an agent with all four mandatory fields filled', () => {
    expect(validateAgent(draft())).toEqual({});
    expect(hasFieldErrors(validateAgent(draft()))).toBe(false);
  });

  it('reports the blank mandatory fields and nothing else', () => {
    expect(validateAgent(draft({ name: '', systemPrompt: '', description: '' }))).toEqual({
      name: 'Name is required.',
      systemPrompt: 'System prompt is required.',
    });
  });

  it('treats whitespace as blank, so a space is not a name', () => {
    expect(validateAgent(draft({ name: '   ', systemPrompt: '\n\t ' }))).toEqual({
      name: 'Name is required.',
      systemPrompt: 'System prompt is required.',
    });
  });

  it('reports a missing status or model, which only a broken caller can produce', () => {
    const errors = validateAgent(draft({ status: '' as AgentDraft['status'], model: '' }));
    expect(errors).toEqual({
      status: 'Status is required.',
      model: 'Model is required.',
    });
    expect(hasFieldErrors(errors)).toBe(true);
  });
});
