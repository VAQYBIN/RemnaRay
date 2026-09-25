import { describe, expect, it } from 'vitest';

import type { PanelUser } from '@remnaray/remnawave-sdk';

import { createRemnawaveMock } from './index.js';

describe('remnawave mock', () => {
  it('creates and updates users through the panel contract', async () => {
    const app = createRemnawaveMock();
    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { username: 'rr_test', expireAt: new Date().toISOString() },
    });
    expect(created.statusCode).toBe(201);
    const user = responseOf(created.body).response;
    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/users',
      payload: { id: user.id, status: 'DISABLED' },
    });
    expect(responseOf(updated.body).response.status).toBe('DISABLED');
    await app.close();
  });
});

describe('remnawave mock tag rule', () => {
  it('refuses a tag the panel refuses', async () => {
    const app = createRemnawaveMock();
    const expireAt = new Date().toISOString();
    for (const tag of ['month', 'PRO-3M', 'A'.repeat(17)]) {
      const refused = await app.inject({
        method: 'POST',
        url: '/api/users',
        payload: { username: 'rr_tag', expireAt, tag },
      });
      expect(refused.statusCode).toBe(400);
    }
    const created = await app.inject({
      method: 'POST',
      url: '/api/users',
      payload: { username: 'rr_tag', expireAt, tag: 'PRO_3M' },
    });
    expect(created.statusCode).toBe(201);
    const updated = await app.inject({
      method: 'PATCH',
      url: '/api/users',
      payload: { id: responseOf(created.body).response.id, tag: 'pro' },
    });
    expect(updated.statusCode).toBe(400);
    await app.close();
  });
});

function responseOf(body: string): { response: PanelUser } {
  const value: unknown = JSON.parse(body);
  if (typeof value !== 'object' || value === null || !('response' in value)) {
    throw new Error('invalid mock response');
  }
  return { response: value.response as PanelUser };
}
