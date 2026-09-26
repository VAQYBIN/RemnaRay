'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { EmptyState, ErrorState, Skeleton } from '@remnaray/ui';

import type { Resource } from '../../../lib/resource';

/** Localized message for a section 9.3 error code, with a safe fallback. */
export function useErrorMessage(): (
  code: string,
  ids?: { incidentId?: string | undefined; requestId?: string | undefined },
) => string {
  const t = useTranslations('errors');
  return (code, ids = {}) => {
    const key = code.toLowerCase();
    const values = { incidentId: ids.incidentId ?? '—', requestId: ids.requestId ?? '—' };
    return t.has(key) ? t(key, values) : t('internal_error', values);
  };
}

export function LoadingState({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" data-state="loading">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton className="h-20 w-full" key={index} />
      ))}
    </div>
  );
}

export function FailureState({
  code,
  requestId,
  incidentId,
  onRetry,
}: {
  code: string;
  requestId?: string;
  incidentId?: string;
  onRetry: () => void;
}) {
  const t = useTranslations('account');
  const message = useErrorMessage();
  return (
    <div data-state="error">
      <ErrorState
        description={message(code, { incidentId, requestId })}
        onRetry={onRetry}
        title={t('errorTitle')}
        {...(requestId ? { requestId } : {})}
      />
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div data-state="empty">
      <EmptyState
        title={title}
        {...(description ? { description } : {})}
        {...(action ? { action } : {})}
      />
    </div>
  );
}

/**
 * Renders the three states every section 13.4 page must define. `isEmpty`
 * decides when a successful response still has nothing to show.
 */
export function ResourceSection<T>({
  state,
  refresh,
  isEmpty,
  empty,
  rows,
  children,
}: {
  state: Resource<T>;
  refresh: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  rows?: number;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading') return <LoadingState {...(rows ? { rows } : {})} />;
  if (state.status === 'error')
    return (
      <FailureState
        code={state.code}
        onRetry={refresh}
        {...(state.requestId ? { requestId: state.requestId } : {})}
        {...(state.incidentId ? { incidentId: state.incidentId } : {})}
      />
    );
  if (isEmpty?.(state.data) && empty) return <>{empty}</>;
  return <div data-state="ready">{children(state.data)}</div>;
}
