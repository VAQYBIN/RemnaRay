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
      payload: { uuid: user.uuid, status: 'DISABLED' },
    });
    expect(responseOf(updated.body).response.status).toBe('DISABLED');
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
