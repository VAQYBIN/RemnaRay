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

describe('the panel address (section 17.4 step 3)', () => {
  it('takes an address typed without a scheme as https', () => {
    expect(setupPanelSchema.parse({ baseUrl: 'panel.example.com', apiToken: 't' }).baseUrl).toBe(
      'https://panel.example.com',
    );
    expect(
      setupPanelSchema.parse({ baseUrl: '  http://10.0.0.5:3000  ', apiToken: 't' }).baseUrl,
    ).toBe('http://10.0.0.5:3000');
    expect(() => setupPanelSchema.parse({ baseUrl: 'not a url', apiToken: 't' })).toThrow();
  });
});
