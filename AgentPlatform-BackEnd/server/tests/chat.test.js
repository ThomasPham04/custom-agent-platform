import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { resetStore } from '../services/agentStore.js';

const app = () => createApp();

beforeEach(() => resetStore());

describe('POST /api/chat/:agentId/messages', () => {
  it('returns a finished assistant message', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'what time is it in Tokyo?' });

    expect(res.status).toBe(200);
    const { message } = res.body;
    expect(message.role).toBe('assistant');
    expect(message.status).toBe('done');
    expect(message.content.length).toBeGreaterThan(0);
    expect(message.model).toBe('gemini-2.5-flash');
    expect(message.id).toMatch(/^msg_/);
  });

  it('calls the agent tools in order, each with a duration the client can pace from', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'status check' });

    const { toolCalls } = res.body.message;
    expect(toolCalls.map((call) => call.toolId)).toEqual(['current_time', 'http_request']);
    for (const call of toolCalls) {
      expect(call.status).toBe('ok');
      expect(call.durationMs).toBeGreaterThan(0);
      expect(call.result).toBeDefined();
      expect(call.id).toMatch(/^call_/);
    }
  });

  it('caps tool calls at two', async () => {
    const res = await request(app())
      .post('/api/chat/agent_research/messages')
      .send({ content: 'summarise the refund policy' });
    expect(res.body.message.toolCalls).toHaveLength(2);
  });

  it('returns no tool calls for an agent with no tools', async () => {
    const res = await request(app())
      .post('/api/chat/agent_drafter/messages')
      .send({ content: 'draft notes' });
    expect(res.body.message.toolCalls).toEqual([]);
    expect(res.body.message.status).toBe('done');
  });

  it('reports latency as the sum of durations plus model time', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'status check' });
    const { message } = res.body;
    const toolTime = message.toolCalls.reduce((total, call) => total + call.durationMs, 0);
    expect(message.latencyMs).toBe(toolTime + 180);
  });

  it('fails the last call when the message contains "fail"', async () => {
    const res = await request(app())
      .post('/api/chat/agent_support/messages')
      .send({ content: 'make this FAIL please' });

    const { message } = res.body;
    expect(message.status).toBe('error');
    const last = message.toolCalls.at(-1);
    expect(last.status).toBe('error');
    expect(last.error).toContain('connection refused');
    expect(last.result).toBeUndefined();
    expect(message.toolCalls[0].status).toBe('ok');
  });

  it('rejects a blank message', async () => {
    const res = await request(app()).post('/api/chat/agent_support/messages').send({ content: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });

  it('404s for an unknown agent', async () => {
    const res = await request(app()).post('/api/chat/agent_nope/messages').send({ content: 'hi' });
    expect(res.status).toBe(404);
  });
});
