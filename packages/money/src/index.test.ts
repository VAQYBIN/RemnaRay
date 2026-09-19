import { describe, expect, it } from 'vitest';

import {
  add,
  compare,
  createMoney,
  formatMoney,
  fromDecimal,
  negate,
  parseMinor,
  subtract,
} from './index';

describe('money', () => {
  it('uses bigint minor units and exact decimal parsing', () => {
    expect(fromDecimal('299.00')).toEqual({ amountMinor: 29900n, currency: 'RUB' });
    expect(fromDecimal('-0.5', 'USD')).toEqual({ amountMinor: -50n, currency: 'USD' });
    expect(parseMinor('9007199254740993')).toBe(9007199254740993n);
  });

  it('adds, subtracts, compares, and negates same-currency values', () => {
    const a = createMoney(29900n);
    const b = createMoney(100n);
    expect(add(a, b).amountMinor).toBe(30000n);
    expect(subtract(a, b).amountMinor).toBe(29800n);
    expect(negate(a).amountMinor).toBe(-29900n);
    expect(compare(a, b)).toBe(1);
    expect(compare(a, a)).toBe(0);
    expect(compare(b, a)).toBe(-1);
  });

  it('rejects invalid values and currency mismatches', () => {
    expect(() => parseMinor('1.5')).toThrow();
    expect(() => fromDecimal('1.234')).toThrow();
    expect(() => createMoney(1n, 'RUBB')).toThrow();
    expect(() => add(createMoney(1n, 'RUB'), createMoney(1n, 'USD'))).toThrow('Currency mismatch');
  });

  it('formats negative and large amounts without floating point', () => {
    expect(formatMoney(createMoney(29900n))).toBe('299.00 RUB');
    expect(formatMoney(createMoney(-5n))).toBe('-0.05 RUB');
    expect(formatMoney(createMoney(9007199254740993n, 'USD'))).toBe('90071992547409.93 USD');
  });
});
