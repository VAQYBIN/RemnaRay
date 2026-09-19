'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { EmptyState, ErrorState, Skeleton } from '@remnaray/ui';

import type { Resource } from '../../lib/resource';

export function useAdminErrorMessage(): (code: string) => string {
  const errors = useTranslations('errors');
  return (code: string) => {
    const key = code.toLowerCase();
    return errors.has(key)
      ? errors(key, { incidentId: '', requestId: '' })
      : errors('internal_error', { incidentId: '' });
  };
}

export function AdminSection<T>({
  state,
  refresh,
  isEmpty,
  children,
}: {
  state: Resource<T>;
  refresh: () => void;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  const t = useTranslations('admin');
  const message = useAdminErrorMessage();

  if (state.status === 'loading')
    return (
      <div className="flex flex-col gap-3" data-state="loading">
        {[0, 1, 2].map((row) => (
          <Skeleton className="h-24 w-full" key={row} />
        ))}
      </div>
    );
  if (state.status === 'error')
    return (
      <div data-state="error">
        <ErrorState
          description={message(state.code)}
          onRetry={refresh}
          title={t('errorTitle')}
          {...(state.requestId ? { requestId: state.requestId } : {})}
        />
      </div>
    );
  if (isEmpty?.(state.data))
    return (
      <div data-state="empty">
        <EmptyState title={t('empty')} />
      </div>
    );
  return <div data-state="ready">{children(state.data)}</div>;
}
