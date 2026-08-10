import { describe, expect, it } from 'vitest';
import { suggestedPrompts } from './suggested-prompts';

describe('suggestedPrompts', () => {
  it('always returns exactly three prompts', () => {
    expect(suggestedPrompts([])).toHaveLength(3);
    expect(suggestedPrompts(['current_time'])).toHaveLength(3);
    expect(
      suggestedPrompts(['current_time', 'http_request', 'calculator', 'knowledge_search']),
    ).toHaveLength(3);
  });

  it('leads with a prompt derived from the first tool', () => {
    expect(suggestedPrompts(['current_time'])[0]).toContain('Tokyo');
    expect(suggestedPrompts(['calculator'])[0]).toMatch(/\d/);
  });

  it('prefers tool-derived prompts over the generic fallbacks', () => {
    const prompts = suggestedPrompts(['current_time', 'http_request']);
    expect(prompts[0]).toContain('Tokyo');
    expect(prompts[1]).toContain('status.example.com');
  });

  it('falls back to generic prompts for an agent with no tools', () => {
    const prompts = suggestedPrompts([]);
    expect(prompts.every((prompt) => prompt.length > 0)).toBe(true);
    expect(new Set(prompts).size).toBe(3);
  });

  it('ignores unknown tool ids', () => {
    expect(suggestedPrompts(['teleport'])).toEqual(suggestedPrompts([]));
  });
});
