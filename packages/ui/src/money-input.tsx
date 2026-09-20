'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';

import { Input } from './input';
import { cn } from './lib/utils';

const DECIMAL = /^\d*(?:[.,]\d{0,2})?$/;

/** Converts a user-typed decimal string into exact minor units. */
export function toMinor(value: string): bigint | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [units = '0', fraction = ''] = normalized.split('.');
  return BigInt(units) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
}

/** Renders exact minor units as a decimal string without floating-point maths. */
export function fromMinor(minor: bigint): string {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  return `${negative ? '-' : ''}${(absolute / 100n).toString()}.${(absolute % 100n)
    .toString()
    .padStart(2, '0')}`;
}

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  valueMinor: bigint | null;
  currency?: string;
  onValueChange: (minor: bigint | null) => void;
};

export function MoneyInput({
  valueMinor,
  currency = 'RUB',
  onValueChange,
  className,
  ...props
}: MoneyInputProps) {
  const id = useId();
  const [text, setText] = useState(valueMinor === null ? '' : fromMinor(valueMinor));

  return (
    <div className={cn('relative', className)}>
      <Input
        aria-describedby={id}
        className="pr-14"
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          if (next !== '' && !DECIMAL.test(next.replace(',', '.'))) return;
          setText(next);
          onValueChange(next === '' ? null : toMinor(next));
        }}
        {...props}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        id={id}
      >
        {currency}
      </span>
    </div>
  );
}
