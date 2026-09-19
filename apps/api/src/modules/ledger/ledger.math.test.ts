import { describe, expect, it } from 'vitest';

import { availableBalance, nextBalance } from './ledger.math';

describe('ledger math', () => {
  it('uses opposite signs for passive user and active system accounts', () => {
    const user = { id: 'u', kind: 'user' as const, balanceMinor: 1000n };
    const revenue = { id: 'r', kind: 'revenue' as const, balanceMinor: 1000n };
    expect(nextBalance(user, 'credit', 250n)).toBe(1250n);
    expect(nextBalance(user, 'debit', 250n)).toBe(750n);
    expect(nextBalance(revenue, 'debit', 250n)).toBe(1250n);
    expect(nextBalance(revenue, 'credit', 250n)).toBe(750n);
  });

  it('subtracts held rewards from spendable user balance', () => {
    expect(availableBalance(1000n, 300n)).toBe(700n);
    expect(availableBalance(100n, 300n)).toBe(-200n);
    expect(() => availableBalance(100n, -1n)).toThrow();
  });
});
