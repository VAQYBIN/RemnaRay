import type { ReactNode } from 'react';

import { Button } from './button.js';
import { cn } from './lib/utils.js';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  requestId,
  onRetry,
}: {
  title?: string;
  description?: string;
  requestId?: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border border-danger/40 bg-danger/5 p-8 text-center"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {requestId ? (
        <p className="font-mono text-xs text-muted-foreground">Request: {requestId}</p>
      ) : null}
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
