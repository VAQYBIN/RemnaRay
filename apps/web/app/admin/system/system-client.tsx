'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { permissions as allPermissions } from '@remnaray/domain';
import { Button, DataTable, Stat, useToast } from '@remnaray/ui';

import { adminApi, errorCode } from '../../../lib/admin-client';
import { bytes } from '../../../lib/format';
import { invalidate, useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection, useAdminErrorMessage } from '../admin-states';

const overviewSchema = z.object({
  app: z.object({ version: z.string(), node: z.string(), uptimeSeconds: z.number() }),
  images: z.object({
    app: z.string().nullable(),
    web: z.string().nullable(),
    proxy: z.string().nullable(),
  }),
  panel: z.object({ lastSyncedAt: z.string().nullable(), baseUrl: z.string() }),
  bot: z.object({ mode: z.unknown(), username: z.unknown() }),
  outboxPending: z.number(),
  database: z.object({
    sizeBytes: z.number(),
    volume: z
      .object({ freeBytes: z.number().nullable(), freePct: z.number().nullable() })
      .optional(),
  }),
  tls: z.object({ domain: z.string(), expiresAt: z.string().nullable() }),
  backups: z.object({ lastRunAt: z.string().nullable() }),
  healthUrl: z.string(),
});

const queuesSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      waiting: z.number(),
      active: z.number(),
      failed: z.number(),
      delayed: z.number(),
    }),
  ),
});

type Data = { overview: z.infer<typeof overviewSchema>; queues: z.infer<typeof queuesSchema> };

export default function SystemClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [pending, setPending] = useState(false);

  const resource = useResource<Data>('admin:system', async () => {
    const api = adminApi();
    const [overview, queues] = await Promise.all([
      api.get('api/admin/v1/system', overviewSchema),
      api.get('api/admin/v1/system/queues', queuesSchema),
    ]);
    return { overview, queues };
  });

  const retry = useCallback(
    (name: string) => {
      setPending(true);
      adminApi()
        .send('POST', `api/admin/v1/system/queues/${name}/retry-failed`, z.unknown())
        .then(
          () => {
            invalidate('admin:system');
            toast({ title: t('saved') });
          },
          (error: unknown) => {
            toast({
              title: t('errorTitle'),
              description: message(errorCode(error)),
              variant: 'danger',
            });
          },
        )
        .finally(() => {
          setPending(false);
        });
    },
    [message, t, toast],
  );

  return (
    <AdminShell>
      {(me) => {
        const canWrite =
          allPermissions.includes('system.write') && me.permissions.includes('system.write');
        return (
          <section className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">{t('system.title')}</h1>
            <AdminSection refresh={resource.refresh} state={resource.state}>
              {(data) => (
                <div className="flex flex-col gap-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label={t('system.version')} value={data.overview.app.version} />
                    <Stat label={t('system.uptime')} value={data.overview.app.uptimeSeconds} />
                    <Stat
                      label={t('system.panelSync')}
                      value={
                        data.overview.panel.lastSyncedAt
                          ? new Date(data.overview.panel.lastSyncedAt).toLocaleString('ru')
                          : t('dashboard.never')
                      }
                    />
                    <Stat label={t('system.outbox')} value={data.overview.outboxPending} />
                    <Stat
                      label={t('system.dbSize')}
                      value={bytes(data.overview.database.sizeBytes)}
                    />
                    <Stat
                      label={t('system.diskFree')}
                      value={
                        data.overview.database.volume?.freeBytes != null &&
                        data.overview.database.volume.freePct != null
                          ? `${bytes(data.overview.database.volume.freeBytes)} (${data.overview.database.volume.freePct.toFixed(1)} %)`
                          : t('system.diskUnknown')
                      }
                    />
                    <Stat label={t('bot.mode')} value={String(data.overview.bot.mode)} />
                    <Stat
                      label={t('system.health')}
                      value={
                        <a className="text-primary underline" href={data.overview.healthUrl}>
                          {data.overview.healthUrl}
                        </a>
                      }
                    />
                  </div>

                  <div>
                    <h2 className="mb-3 text-lg font-semibold">{t('system.queues')}</h2>
                    <DataTable
                      columns={[
                        { key: 'name', header: t('system.queues'), cell: (row) => row.name },
                        { key: 'waiting', header: 'waiting', cell: (row) => row.waiting },
                        { key: 'active', header: 'active', cell: (row) => row.active },
                        { key: 'failed', header: 'failed', cell: (row) => row.failed },
                        { key: 'delayed', header: 'delayed', cell: (row) => row.delayed },
                        {
                          key: 'actions',
                          header: '',
                          cell: (row) =>
                            canWrite && row.failed > 0 ? (
                              <Button
                                disabled={pending}
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  retry(row.name);
                                }}
                              >
                                {t('system.retryFailed')}
                              </Button>
                            ) : null,
                        },
                      ]}
                      labels={{
                        loadMore: t('more'),
                        emptyTitle: t('empty'),
                        errorTitle: t('errorTitle'),
                      }}
                      rowKey={(row) => row.name}
                      rows={data.queues.items}
                    />
                  </div>

                  {canWrite ? (
                    <div>
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() => {
                          setPending(true);
                          adminApi()
                            .send('POST', 'api/admin/v1/system/reconcile', z.unknown())
                            .then(
                              () => {
                                toast({ title: t('saved') });
                              },
                              (error: unknown) => {
                                toast({
                                  title: t('errorTitle'),
                                  description: message(errorCode(error)),
                                  variant: 'danger',
                                });
                              },
                            )
                            .finally(() => {
                              setPending(false);
                            });
                        }}
                      >
                        {t('panel.reconcile')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </AdminSection>
          </section>
        );
      }}
    </AdminShell>
  );
}
