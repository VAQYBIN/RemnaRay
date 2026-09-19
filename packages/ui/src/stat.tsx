import type { ReactNode } from 'react';

import { cn } from './lib/utils';

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {icon ? <span className="text-primary">{icon}</span> : null}
    </div>
  );
}
