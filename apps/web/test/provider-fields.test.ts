import { describe, expect, it } from 'vitest';

import {
  complete,
  initialValues,
  toConfig,
  type ProviderField,
} from '../app/_components/provider-fields';

const fields: ProviderField[] = [
  { key: 'shopId', type: 'string', required: true, secret: false },
  { key: 'secretKey', type: 'string', required: true, secret: true },
  { key: 'ipRanges', type: 'list', required: false, secret: false, default: ['a/1', 'b/2'] },
  { key: 'isTest', type: 'boolean', required: false, secret: false, default: false },
  { key: 'starsPerRub', type: 'number', required: false, secret: false },
];

describe('provider form (FR-061)', () => {
  it('starts from stored values and defaults, never from a stored secret', () => {
    expect(initialValues(fields, { shopId: '42', secretKey: 'live_abc' })).toEqual({
      shopId: '42',
      secretKey: '',
      ipRanges: 'a/1\nb/2',
      isTest: false,
      starsPerRub: '',
    });
  });

  it('sends typed values and leaves out empty fields', () => {
    expect(
      toConfig(fields, {
        shopId: ' 42 ',
        secretKey: '',
        ipRanges: 'a/1\n\nc/3, d/4',
        isTest: true,
        starsPerRub: '0,75',
      }),
    ).toEqual({ shopId: '42', ipRanges: ['a/1', 'c/3', 'd/4'], isTest: true, starsPerRub: 0.75 });
  });

  it('needs every required field, where a stored secret counts', () => {
    const values = { shopId: '42', secretKey: '', ipRanges: '', isTest: false, starsPerRub: '' };
    expect(complete(fields, values)).toBe(false);
    expect(complete(fields, values, ['secretKey'])).toBe(true);
  });
});
