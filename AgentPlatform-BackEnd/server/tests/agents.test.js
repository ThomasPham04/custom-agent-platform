import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';
import { resetStore } from '../services/agentStore.js';

const app = () => createApp();

beforeEach(() => resetStore());

describe('GET /api/agents', () => {
  it('returns the seeded agents', async () => {
    const res = await request(app()).get('/api/agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
  });

  it('covers the render states the UI needs', async () => {
    const { body } = await request(app()).get('/api/agents');
    expect(body.some((agent) => agent.toolIds.length > 2)).toBe(true);
    expect(body.some((agent) => agent.toolIds.length === 1)).toBe(true);
    expect(body.some((agent) => agent.toolIds.length === 0 && agent.status === 'draft')).toBe(true);
    expect(body.some((agent) => agent.name.length > 24)).toBe(true);
  });
});

describe('POST /api/agents', () => {
  it('creates a draft with defaults', async () => {
    const res = await request(app()).post('/api/agents').send({});
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New agent');
    expect(res.body.status).toBe('draft');
    expect(res.body.model).toBe('gemini-2.5-flash');
    expect(res.body.toolIds).toEqual([]);
    expect(res.body.id).toMatch(/^agent_/);
  });

  it('accepts supplied fields', async () => {
    const res = await request(app())
      .post('/api/agents')
      .send({ name: 'Copy of Support', toolIds: ['current_time'], status: 'active' });
    expect(res.body.name).toBe('Copy of Support');
    expect(res.body.toolIds).toEqual(['current_time']);
    expect(res.body.status).toBe('active');
  });

  it('rejects an unknown tool id', async () => {
    const res = await request(app()).post('/api/agents').send({ toolIds: ['teleport'] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('teleport');
  });
});

describe('PATCH /api/agents/:id', () => {
  it('applies the patch and moves updatedAt forward', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const agent = agents[0];
    const res = await request(app())
      .patch(`/api/agents/${agent.id}`)
      .send({ systemPrompt: 'Be terse.' });
    expect(res.status).toBe(200);
    expect(res.body.systemPrompt).toBe('Be terse.');
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(agent.updatedAt).getTime(),
    );
  });

  it('ignores attempts to change the id', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).patch(`/api/agents/${agents[0].id}`).send({ id: 'agent_hijack' });
    expect(res.body.id).toBe(agents[0].id);
  });

  it('rejects an unknown model', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).patch(`/api/agents/${agents[0].id}`).send({ model: 'gpt-4' });
    expect(res.status).toBe(400);
  });

  it('404s for a missing agent', async () => {
    const res = await request(app()).patch('/api/agents/agent_nope').send({ name: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('DELETE /api/agents/:id', () => {
  it('removes the agent', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).delete(`/api/agents/${agents[0].id}`);
    expect(res.status).toBe(204);
    const after = await request(app()).get('/api/agents');
    expect(after.body).toHaveLength(3);
  });

  it('404s for a missing agent', async () => {
    const res = await request(app()).delete('/api/agents/agent_nope');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/agents/:id', () => {
  it('returns one agent', async () => {
    const { body: agents } = await request(app()).get('/api/agents');
    const res = await request(app()).get(`/api/agents/${agents[0].id}`);
    expect(res.body.id).toBe(agents[0].id);
  });
});
