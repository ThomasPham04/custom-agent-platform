import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('GET /api/health', () => {
  it('reports mock mode', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mode: 'mock' });
  });
});

describe('unknown routes', () => {
  it('returns the standard error envelope', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
    expect(typeof res.body.error.message).toBe('string');
  });
});
