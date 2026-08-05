import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('GET /api/tools', () => {
  it('returns the four registered tools', async () => {
    const res = await request(createApp()).get('/api/tools');
    expect(res.status).toBe(200);
    expect(res.body.map((tool) => tool.id)).toEqual([
      'current_time',
      'http_request',
      'calculator',
      'knowledge_search',
    ]);
  });

  it('describes each tool with a label and params', async () => {
    const res = await request(createApp()).get('/api/tools');
    for (const tool of res.body) {
      expect(tool.label.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(Array.isArray(tool.params)).toBe(true);
    }
  });

  it('marks required params', async () => {
    const res = await request(createApp()).get('/api/tools');
    const http = res.body.find((tool) => tool.id === 'http_request');
    expect(http.params.find((param) => param.name === 'url').required).toBe(true);
    expect(http.params.find((param) => param.name === 'method').required).toBe(false);
  });
});
