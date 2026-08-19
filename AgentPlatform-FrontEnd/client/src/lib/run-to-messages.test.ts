import { describe, expect, it } from 'vitest';
import { runsToMessages } from './run-to-messages';
import type { Run } from '../types/run';

const run = (over: Partial<Run> = {}): Run => ({
  id: 'run_1',
  agentId: 'agent_support',
  agentName: 'Support Bot',
  model: 'gemini-3.1-flash-lite',
  systemPrompt: 'Be brief.',
  userMessage: 'what time is it in Tokyo?',
  answer: "It's 9:03 PM in Tokyo.",
  status: 'done',
  error: null,
  latencyMs: 480,
  sessionId: null,
  triggerId: null,
  createdAt: '2026-08-04T12:00:00+00:00',
  toolCalls: [],
  ...over,
});

describe('runsToMessages', () => {
  it('turns one run into a user turn followed by its answer', () => {
    const messages = runsToMessages([run()]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'what time is it in Tokyo?',
      status: 'done',
      createdAt: '2026-08-04T12:00:00+00:00',
    });
    expect(messages[1]).toMatchObject({
      id: 'run_1',
      role: 'assistant',
      content: "It's 9:03 PM in Tokyo.",
      model: 'gemini-3.1-flash-lite',
      latencyMs: 480,
      status: 'done',
    });
  });

  it('gives every message a distinct id', () => {
    const ids = runsToMessages([run({ id: 'run_1' }), run({ id: 'run_2' })]).map((m) => m.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reverses the newest-first order the API returns', () => {
    const messages = runsToMessages([
      run({ id: 'run_new', userMessage: 'second', createdAt: '2026-08-09T12:00:00+00:00' }),
      run({ id: 'run_old', userMessage: 'first', createdAt: '2026-08-01T12:00:00+00:00' }),
    ]);

    expect(messages.map((m) => m.content)).toEqual([
      'first',
      "It's 9:03 PM in Tokyo.",
      'second',
      "It's 9:03 PM in Tokyo.",
    ]);
  });

  it('orders tool calls by seq and drops the wire nulls', () => {
    const messages = runsToMessages([
      run({
        toolCalls: [
          {
            id: 'call_2',
            seq: 1,
            toolId: 'http_request',
            args: { url: 'https://x' },
            result: { status: 200 },
            error: null,
            durationMs: 200,
            status: 'ok',
          },
          {
            id: 'call_1',
            seq: 0,
            toolId: 'current_time',
            args: { timezone: 'Asia/Tokyo' },
            result: '21:03',
            error: null,
            durationMs: 118,
            status: 'ok',
          },
        ],
      }),
    ]);

    const calls = messages[1]!.toolCalls ?? [];
    expect(calls.map((c) => c.id)).toEqual(['call_1', 'call_2']);
    expect(calls[0]).not.toHaveProperty('error');
    expect(calls[0]!.result).toBe('21:03');
  });

  it('keeps a failed call error and marks the turn as an error', () => {
    const messages = runsToMessages([
      run({
        status: 'error',
        error: 'connection refused',
        answer: 'connection refused',
        toolCalls: [
          {
            id: 'call_1',
            seq: 0,
            toolId: 'http_request',
            args: { url: 'https://x' },
            result: null,
            error: 'connection refused',
            durationMs: 90,
            status: 'error',
          },
        ],
      }),
    ]);

    expect(messages[1]!.status).toBe('error');
    expect(messages[1]!.content).toBe('connection refused');
    const call = (messages[1]!.toolCalls ?? [])[0]!;
    expect(call.error).toBe('connection refused');
    expect(call).not.toHaveProperty('result');
  });

  it('does not mutate the caller array', () => {
    const runs = [
      run({ id: 'run_new', createdAt: '2026-08-09T12:00:00+00:00' }),
      run({ id: 'run_old', createdAt: '2026-08-01T12:00:00+00:00' }),
    ];

    runsToMessages(runs);

    expect(runs.map((r) => r.id)).toEqual(['run_new', 'run_old']);
  });

  it('returns nothing for no runs', () => {
    expect(runsToMessages([])).toEqual([]);
  });
});

describe('runsToMessages retry history', () => {
  /**
   * Deliberate, not a bug. The live thread replaces a failed turn with its
   * retry, but both runs are persisted and both are expanded here: the run log
   * is an audit trail and a failure is never rewritten out of it.
   */
  it('expands a retried prompt as both the failure and the success', () => {
    const messages = runsToMessages([
      run({
        id: 'run_retry',
        userMessage: 'please fail this run',
        answer: 'All good this time.',
        status: 'done',
        createdAt: '2026-08-04T12:00:05+00:00',
      }),
      run({
        id: 'run_failed',
        userMessage: 'please fail this run',
        answer: 'http_request failed: connection refused.',
        status: 'error',
        error: 'connection refused',
        createdAt: '2026-08-04T12:00:00+00:00',
      }),
    ]);

    expect(messages.map((m) => [m.role, m.status])).toEqual([
      ['user', 'done'],
      ['assistant', 'error'],
      ['user', 'done'],
      ['assistant', 'done'],
    ]);
    expect(messages[0]!.content).toBe('please fail this run');
    expect(messages[2]!.content).toBe('please fail this run');
  });
});
