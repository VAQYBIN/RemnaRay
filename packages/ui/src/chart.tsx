'use client';

import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from './lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export type SeriesPoint = { label: string; value: number };

type ChartProps = {
  title: string;
  points: SeriesPoint[];
  /** Series name shown in the tooltip; a single series needs no legend. */
  seriesLabel: string;
  formatValue?: (value: number) => string;
  emptyLabel: string;
  tableLabels?: { period: string; value: string };
  className?: string;
  children?: ReactNode;
};

const AXIS = 'var(--color-muted-foreground)';
const GRID = 'var(--color-border)';
const MARK = 'var(--color-primary)';

function Frame({
  title,
  className,
  children,
  points,
  emptyLabel,
}: {
  title: string;
  className?: string | undefined;
  points: SeriesPoint[];
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <figure
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-surface p-4',
        className,
      )}
    >
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {points.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        children
      )}
    </figure>
  );
}

function DataFallback({
  points,
  formatValue,
  labels,
}: {
  points: SeriesPoint[];
  formatValue: (value: number) => string;
  labels: { period: string; value: string };
}) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">{labels.value}</summary>
      <Table className="mt-2 text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>{labels.period}</TableHead>
            <TableHead>{labels.value}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point) => (
            <TableRow key={point.label}>
              <TableCell>{point.label}</TableCell>
              <TableCell>{formatValue(point.value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/** Single-series area chart: change over time, one axis, recessive grid. */
export function TrendChart({
  title,
  points,
  seriesLabel,
  formatValue = (value) => value.toString(),
  emptyLabel,
  tableLabels = { period: 'Period', value: 'Value' },
  className,
}: ChartProps) {
  return (
    <Frame className={className} emptyLabel={emptyLabel} points={points} title={title}>
      <div className="h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={AXIS} tickLine={false} tickMargin={8} />
            <YAxis
              stroke={AXIS}
              tickFormatter={formatValue}
              tickLine={false}
              width={72}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => [formatValue(Number(value)), seriesLabel] as [string, string]}
            />
            <Area
              dataKey="value"
              fill={MARK}
              fillOpacity={0.15}
              name={seriesLabel}
              stroke={MARK}
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <DataFallback formatValue={formatValue} labels={tableLabels} points={points} />
    </Frame>
  );
}

/** Single-series bar chart: magnitude per period, rounded data-ends. */
export function CountChart({
  title,
  points,
  seriesLabel,
  formatValue = (value) => value.toString(),
  emptyLabel,
  tableLabels = { period: 'Period', value: 'Value' },
  className,
}: ChartProps) {
  return (
    <Frame className={className} emptyLabel={emptyLabel} points={points} title={title}>
      <div className="h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={AXIS} tickLine={false} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              stroke={AXIS}
              tickFormatter={formatValue}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value) => [formatValue(Number(value)), seriesLabel] as [string, string]}
            />
            <Bar dataKey="value" fill={MARK} name={seriesLabel} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataFallback formatValue={formatValue} labels={tableLabels} points={points} />
    </Frame>
  );
}
