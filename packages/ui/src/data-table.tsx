'use client';

import type { ReactNode } from 'react';

import { Button } from './button';
import { EmptyState, ErrorState, Skeleton } from './states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { cn } from './lib/utils';

export type DataTableColumn<TRow> = {
  key: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  className?: string;
};

export type DataTableLabels = {
  loadMore: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle?: string;
  retry?: string;
};

/**
 * Cursor-paginated table. `nextCursor === null` hides the "load more" control,
 * matching the `{ items, nextCursor }` response shape from section 9.1.
 */
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  state = 'ready',
  labels,
  nextCursor = null,
  loadingMore = false,
  onLoadMore,
  onRetry,
  requestId,
  emptyAction,
  className,
}: {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow) => string;
  state?: 'loading' | 'error' | 'ready';
  labels: DataTableLabels;
  nextCursor?: string | null;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  requestId?: string;
  emptyAction?: ReactNode;
  className?: string;
}) {
  if (state === 'loading') {
    return (
      <div className={cn('flex flex-col gap-2', className)} data-state="loading">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton className="h-10 w-full" key={row} />
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={className} data-state="error">
        <ErrorState
          {...(labels.errorTitle ? { title: labels.errorTitle } : {})}
          {...(requestId ? { requestId } : {})}
          onRetry={onRetry ?? (() => undefined)}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={className} data-state="empty">
        <EmptyState
          title={labels.emptyTitle}
          {...(labels.emptyDescription ? { description: labels.emptyDescription } : {})}
          {...(emptyAction ? { action: emptyAction } : {})}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)} data-state="ready">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead className={column.className} key={column.key}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell className={column.className} key={column.key}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {nextCursor && onLoadMore ? (
        <Button disabled={loadingMore} variant="secondary" onClick={onLoadMore}>
          {labels.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
