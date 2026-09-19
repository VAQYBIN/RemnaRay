export type Minor = bigint;

export type Money = {
  amountMinor: Minor;
  currency: string;
};

const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

function assertCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Currency mismatch: ${left.currency} and ${right.currency}`);
  }
}

export function createMoney(amountMinor: Minor, currency = 'RUB'): Money {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(`Invalid currency: ${currency}`);
  }
  return { amountMinor, currency };
}

export function parseMinor(value: string): Minor {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid minor amount: ${value}`);
  }
  return BigInt(value);
}

export function fromDecimal(value: string, currency = 'RUB'): Money {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid decimal amount: ${value}`);
  }
  const [, sign, units, fraction = ''] = match;
  const minor = BigInt(units) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return createMoney(sign ? -minor : minor, currency);
}

export function add(left: Money, right: Money): Money {
  assertCurrency(left, right);
  return createMoney(left.amountMinor + right.amountMinor, left.currency);
}

export function subtract(left: Money, right: Money): Money {
  assertCurrency(left, right);
  return createMoney(left.amountMinor - right.amountMinor, left.currency);
}

export function negate(value: Money): Money {
  return createMoney(-value.amountMinor, value.currency);
}

export function compare(left: Money, right: Money): -1 | 0 | 1 {
  assertCurrency(left, right);
  return left.amountMinor < right.amountMinor ? -1 : left.amountMinor > right.amountMinor ? 1 : 0;
}

export function formatMoney(value: Money): string {
  const negative = value.amountMinor < 0n;
  const absolute = negative ? -value.amountMinor : value.amountMinor;
  const units = absolute / 100n;
  const minor = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${units.toString()}.${minor} ${value.currency}`;
}
