import { describe, expect, it } from 'vitest';

import { SetupPendingError, setupPending, skipWhileSetup } from './worker.service';

describe('jobs while the setup wizard runs (section 17.4)', () => {
  it('recognises the API refusing because setup has not finished', () => {
    const body = JSON.stringify({
      error: { code: 'SETUP_NOT_COMPLETED', message: 'SETUP_NOT_COMPLETED' },
    });
    expect(setupPending(503, body)).toBe(true);
    expect(setupPending(503, JSON.stringify({ error: { code: 'PANEL_UNAVAILABLE' } }))).toBe(false);
    expect(setupPending(500, body)).toBe(false);
    expect(setupPending(503, '<html>')).toBe(false);
  });

  it('completes such a job as skipped and lets every other failure fail', async () => {
    await expect(
      skipWhileSetup(() =>
        Promise.reject(new SetupPendingError('/api/internal/v1/payments/expire')),
      ),
    ).resolves.toEqual({ skipped: 'SETUP_NOT_COMPLETED' });
    await expect(skipWhileSetup(() => Promise.reject(new Error('502')))).rejects.toThrow('502');
    await expect(skipWhileSetup(() => Promise.resolve({ ok: true }))).resolves.toEqual({
      ok: true,
    });
  });
});
