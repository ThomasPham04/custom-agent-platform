import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

describe('JSON request errors', () => {
  it('maps malformed JSON to the standard bad-request envelope', async () => {
    const res = await request(createApp())
      .post('/api/agents')
      .set('Content-Type', 'application/json')
      .send('{"name":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'bad_request', message: 'Malformed JSON body.' },
    });
  });

  it('maps an oversized JSON body to the standard payload-too-large envelope', async () => {
    const res = await request(createApp())
      .post('/api/agents')
      .send({ systemPrompt: 'x'.repeat(300 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({
      error: { code: 'payload_too_large', message: 'Request body is too large.' },
    });
  });
});
