import { describe, expect, it } from 'vitest';

import { ApiClient } from './api-client.js';

describe('ApiClient', () => {
  it('sends the internal token and acting Telegram identity', async () => {
    const requests: Request[] = [];
    const api = new ApiClient({
      baseUrl: 'http://api.test',
      internalToken: 'internal-secret',
      fetchImpl: (input, init) => {
        requests.push(new Request(input, init));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: 'u1',
                telegramId: '123',
                username: null,
                firstName: null,
                language: 'ru',
                referralCode: 'ABCD2345',
                isBanned: false,
              },
              created: true,
              attributed: false,
              promoReserved: false,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    });

    const result = await api.request<{ user: { telegramId: string } }>('/api/internal/v1/me', {
      method: 'GET',
      userId: 123,
    });

    expect(result.user.telegramId).toBe('123');
    expect(requests[0]?.headers.get('x-internal-token')).toBe('internal-secret');
    expect(requests[0]?.headers.get('x-acting-user')).toBe('123');
  });

  it('turns structured API errors into ApiClientError', async () => {
    const api = new ApiClient({
      fetchImpl: () =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'PANEL_UNAVAILABLE' }), { status: 503 }),
        ),
    });
    await expect(api.request('/failure')).rejects.toMatchObject({
      status: 503,
      code: 'PANEL_UNAVAILABLE',
    });
  });

  it('sends support text through the internal boundary', async () => {
    let body = '';
    const api = new ApiClient({
      fetchImpl: (_input, init) => {
        body = typeof init?.body === 'string' ? init.body : '';
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    await api.forwardSupport(42, 7, 'hello');
    expect(body).toContain('hello');
  });
});
