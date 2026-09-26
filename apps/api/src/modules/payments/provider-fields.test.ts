import { describe, expect, it } from 'vitest';

import { createPaymentProviderRegistry } from './payments.registry';
import { mergeProviderConfig, providerFields } from './provider-fields';

describe('provider configuration fields (FR-061)', () => {
  const registry = createPaymentProviderRegistry({});

  it('describes each field of a provider schema for the form', () => {
    const fields = providerFields(registry.get('yookassa').configSchema);

    expect(fields.find((field) => field.key === 'shopId')).toEqual({
      key: 'shopId',
      type: 'string',
      required: true,
      secret: false,
    });
    expect(fields.find((field) => field.key === 'secretKey')).toMatchObject({ secret: true });
    expect(fields.find((field) => field.key === 'ipRanges')).toMatchObject({
      type: 'list',
      required: false,
    });
  });

  it('describes numbers, flags and URLs', () => {
    const robokassa = providerFields(registry.get('robokassa').configSchema);
    expect(robokassa.find((field) => field.key === 'isTest')).toMatchObject({
      type: 'boolean',
      default: false,
    });
    expect(robokassa.find((field) => field.key === 'baseUrl')).toMatchObject({ format: 'uri' });
    expect(providerFields(registry.get('stars').configSchema)).toEqual([
      { key: 'starsPerRub', type: 'number', required: true, secret: false },
    ]);
  });

  it('keeps a stored secret the console left empty', () => {
    expect(
      mergeProviderConfig({ shopId: '1', secretKey: 'live_abc' }, { shopId: '2', secretKey: '' }),
    ).toEqual({ shopId: '2', secretKey: 'live_abc' });
  });
});
