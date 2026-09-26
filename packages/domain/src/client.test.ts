import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, createApiClient } from './client.js';

describe('the typed API client (section 13.1)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('turns an answer that does not match its contract into a visible, traceable error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchImpl: () =>
        Promise.resolve(
          Response.json(
            { items: [{ description: {} }] },
            { headers: { 'x-request-id': 'req-42' } },
          ),
        ),
    });

    const failure = await client
      .get(
        'api/v1/public/plans',
        z.object({ items: z.array(z.object({ description: z.object({ ru: z.string() }) })) }),
      )
      .catch((error: unknown) => error);

    // A ZodError reached the page as INTERNAL_ERROR with no code to report.
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: 'CONTRACT_MISMATCH', status: 200, requestId: 'req-42' });
    expect(JSON.stringify(log.mock.calls)).toContain('items.0.description.ru');
  });
});
