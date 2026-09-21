import { describe, expect, it } from 'vitest';

import { setupPanelSchema } from './setup.schemas';

describe('setup panel input', () => {
  it('accepts an owner-provided webhook secret without changing it', () => {
    const parsed = setupPanelSchema.parse({
      baseUrl: 'https://panel.example.test',
      apiToken: 'panel-token',
      webhookSecret: 'existing-panel-webhook-secret',
    });

    expect(parsed.webhookSecret).toBe('existing-panel-webhook-secret');
  });

  it('keeps the webhook secret optional for generated secrets', () => {
    const parsed = setupPanelSchema.parse({
      baseUrl: 'https://panel.example.test',
      apiToken: 'panel-token',
    });

    expect(parsed.webhookSecret).toBeUndefined();
  });
});
