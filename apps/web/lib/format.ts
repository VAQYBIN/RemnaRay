import { formatMoneyLocale, type Money } from '@remnaray/money';

export function money(amountMinor: bigint | number, currency: string, locale: string): string {
  const value: Money = { amountMinor: BigInt(amountMinor), currency };
  return formatMoneyLocale(value, locale);
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function bytes(value: number): string {
  if (value <= 0) return '0 B';
  let index = 0;
  let amount = value;
  while (amount >= 1024 && index < UNITS.length - 1) {
    amount /= 1024;
    index += 1;
  }
  const rounded = amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded.toString()} ${UNITS[index] ?? 'B'}`;
}

export function countdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
