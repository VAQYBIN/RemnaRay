import { describe, expect, it } from 'vitest';

import { panelCall } from './worker.service';

describe('panel jobs', () => {
  const data = { userId: '0199a0b0-0000-7000-8000-000000000001' };

  it.each([
    ['panel.sync-user', '/api/internal/v1/remnawave/sync-user', data],
    ['panel.reset-traffic', '/api/internal/v1/remnawave/reset-traffic', data],
    ['panel.delete-user', '/api/internal/v1/remnawave/delete-user', data],
  ])('performs %s with the job data', (name, path, body) => {
    expect(panelCall({ name, data })).toEqual({ path, body });
  });

  it('reconciles only for panel.reconcile-all', () => {
    expect(panelCall({ name: 'panel.reconcile-all', data: {} })).toEqual({
      path: '/api/internal/v1/remnawave/reconcile',
    });
  });

  it('fails a job it does not know instead of reconciling', () => {
    // Reset traffic and delete-user used to fall through to reconciliation.
    expect(() => panelCall({ name: 'panel.unknown', data })).toThrow(/unknown panel job/u);
  });
});
