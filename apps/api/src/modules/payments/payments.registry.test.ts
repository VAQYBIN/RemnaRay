import { describe, expect, it } from 'vitest';

import { createPaymentProviderRegistry } from './payments.registry';

const REAL_PROVIDERS = [
  'yookassa',
  'robokassa',
  'lava',
  'platega',
  'cryptobot',
  'stars',
  'balance',
];

describe('createPaymentProviderRegistry (section 22.4)', () => {
  it('leaves the mock provider out of a production registry', () => {
    for (const env of [{}, { RR_PAYMENTS_MOCK: 'false' }, { RR_PAYMENTS_MOCK: '1' }]) {
      const registry = createPaymentProviderRegistry(env);
      expect(registry.has('mock')).toBe(false);
      expect(() => registry.get('mock')).toThrow('PAYMENT_PROVIDER_NOT_FOUND');
      expect(
        registry
          .list()
          .map((provider) => provider.code)
          .sort(),
      ).toEqual([...REAL_PROVIDERS].sort());
    }
  });

  it('registers the mock provider only when RR_PAYMENTS_MOCK=true', () => {
    const registry = createPaymentProviderRegistry({ RR_PAYMENTS_MOCK: 'true' });
    expect(registry.has('mock')).toBe(true);
    for (const code of REAL_PROVIDERS) expect(registry.has(code)).toBe(true);
  });
});
