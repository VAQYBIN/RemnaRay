'use client';

import { useId } from 'react';

import { Button } from './button';
import { Input } from './input';
import { cn } from './lib/utils';

export type DateRange = { from: string; to: string };

const PRESET_DAYS = [7, 30, 90] as const;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function lastDays(days: number, now = new Date()): DateRange {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

export function DateRangePicker({
  value,
  onChange,
  labels,
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  labels?: { from?: string; to?: string; preset?: (days: number) => string };
  className?: string;
}) {
  const fromId = useId();
  const toId = useId();
  const preset = labels?.preset ?? ((days: number) => `${days.toString()}d`);

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={fromId}>
          {labels?.from ?? 'From'}
        </label>
        <Input
          id={fromId}
          max={value.to}
          type="date"
          value={value.from}
          onChange={(event) => {
            onChange({ ...value, from: event.target.value });
          }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={toId}>
          {labels?.to ?? 'To'}
        </label>
        <Input
          id={toId}
          min={value.from}
          type="date"
          value={value.to}
          onChange={(event) => {
            onChange({ ...value, to: event.target.value });
          }}
        />
      </div>
      <div className="flex gap-2">
        {PRESET_DAYS.map((days) => (
          <Button
            key={days}
            size="sm"
            variant="secondary"
            onClick={() => {
              onChange(lastDays(days));
            }}
          >
            {preset(days)}
          </Button>
        ))}
      </div>
    </div>
  );
}
