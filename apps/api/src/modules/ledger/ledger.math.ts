export type LedgerAccountKind =
  | 'user'
  | 'revenue'
  | 'provider_clearing'
  | 'referral_expense'
  | 'promo_expense'
  | 'refund_pool'
  | 'adjustment';

export type LedgerAccountBalance = {
  id: string;
  kind: LedgerAccountKind;
  balanceMinor: bigint;
};

export function nextBalance(
  account: LedgerAccountBalance,
  side: 'debit' | 'credit',
  amountMinor: bigint,
): bigint {
  if (amountMinor <= 0n) throw new Error('Ledger amount must be positive');
  const userDelta = side === 'credit' ? amountMinor : -amountMinor;
  const systemDelta = side === 'debit' ? amountMinor : -amountMinor;
  return account.balanceMinor + (account.kind === 'user' ? userDelta : systemDelta);
}

export function availableBalance(balanceMinor: bigint, heldMinor: bigint): bigint {
  if (heldMinor < 0n) throw new Error('Held amount cannot be negative');
  return balanceMinor - heldMinor;
}
