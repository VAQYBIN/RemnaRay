import { describe, expect, it } from 'vitest';

import { createRemnawaveClient, PanelError } from './index.js';

describe('RemnawaveClient', () => {
  it('uses a bounded client and exposes panel errors', async () => {
    const client = createRemnawaveClient({
      baseUrl: 'http://127.0.0.1:1',
      apiToken: 'token',
      timeoutMs: 10,
    });
    await expect(client.system.stats()).rejects.toThrow();
    expect(new PanelError('BAD', 400, 'bad').code).toBe('BAD');
    await client.close();
  });
});
