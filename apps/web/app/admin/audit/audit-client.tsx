'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { Button, DataTable, Input, Label } from '@remnaray/ui';

import { adminApi } from '../../../lib/admin-client';
import { useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection } from '../admin-states';

const auditSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      actorAdminId: z.string().nullable(),
      actorType: z.string(),
      action: z.string(),
      entity: z.string(),
      entityId: z.string().nullable(),
      before: z.unknown(),
      after: z.unknown(),
      reason: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
  scope: z.string(),
});

export default function AuditClient() {
  const t = useTranslations('admin');
  const [action, setAction] = useState('');
  const [applied, setApplied] = useState('');
  const query = useMemo(() => ({ limit: 100, ...(applied ? { action: applied } : {}) }), [applied]);

  const resource = useResource(`admin:audit:${applied}`, () =>
    adminApi().get('api/admin/v1/audit', auditSchema, { query }),
  );

  return (
    <AdminShell>
      {() => (
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(action.trim());
            }}
          >
            <div className="flex w-64 flex-col gap-1">
              <Label htmlFor="audit-action">{t('audit.action')}</Label>
              <Input
                id="audit-action"
                value={action}
                onChange={(event) => {
                  setAction(event.target.value);
                }}
              />
            </div>
            <Button type="submit">{t('apply')}</Button>
          </form>

          <AdminSection refresh={resource.refresh} state={resource.state}>
            {(data) => (
              <div className="flex flex-col gap-3">
                {data.scope === 'own' ? (
                  <p className="text-sm text-muted-foreground">{t('audit.scopeOwn')}</p>
                ) : null}
                <DataTable
                  columns={[
                    { key: 'action', header: t('audit.action'), cell: (row) => row.action },
                    {
                      key: 'entity',
                      header: t('audit.entity'),
                      cell: (row) =>
                        `${row.entity}${row.entityId ? `:${row.entityId.slice(0, 8)}` : ''}`,
                    },
                    {
                      key: 'actor',
                      header: t('audit.actor'),
                      cell: (row) => row.actorAdminId?.slice(0, 8) ?? row.actorType,
                    },
                    { key: 'reason', header: t('reason'), cell: (row) => row.reason ?? '—' },
                    {
                      key: 'diff',
                      header: 'before → after',
                      cell: (row) => (
                        <code className="text-xs">
                          {JSON.stringify(row.before)} → {JSON.stringify(row.after)}
                        </code>
                      ),
                    },
                    {
                      key: 'createdAt',
                      header: t('payments.createdAt'),
                      cell: (row) => new Date(row.createdAt).toLocaleString('ru'),
                    },
                  ]}
                  labels={{
                    loadMore: t('more'),
                    emptyTitle: t('empty'),
                    errorTitle: t('errorTitle'),
                  }}
                  rowKey={(row) => row.id}
                  rows={data.items}
                />
              </div>
            )}
          </AdminSection>
        </section>
      )}
    </AdminShell>
  );
}
