'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { permissions as allPermissions } from '@remnaray/domain';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@remnaray/ui';

import { adminApi, errorCode } from '../../../lib/admin-client';
import { adminSubscriptionListSchema } from '../../../lib/admin-contracts';
import { invalidate, useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection, useAdminErrorMessage } from '../admin-states';

type List = z.infer<typeof adminSubscriptionListSchema>;
const STATUSES = [
  'provisioning',
  'active',
  'grace',
  'expired',
  'revoked',
  'provisioning_failed',
] as const;
const BULK_LIMIT = 500;

export default function SubscriptionsClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [status, setStatus] = useState('active');
  const [expiresBefore, setExpiresBefore] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  const query = useMemo(
    () => ({
      status,
      limit: 100,
      ...(expiresBefore ? { expiresBefore: `${expiresBefore}T23:59:59.999Z` } : {}),
    }),
    [expiresBefore, status],
  );

  const resource = useResource<List>(`admin:subscriptions:${status}:${expiresBefore}`, () =>
    adminApi().get('api/admin/v1/subscriptions', adminSubscriptionListSchema, { query }),
  );

  return (
    <AdminShell>
      {(me) => {
        const canBulk =
          allPermissions.includes('subscriptions.bulk') &&
          me.permissions.includes('subscriptions.bulk');
        return (
          <section className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">{t('subscriptions.title')}</h1>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-56 flex-col gap-1">
                <Label htmlFor="sub-status">{t('subscriptions.status')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="sub-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="sub-expires">{t('subscriptions.expiresBefore')}</Label>
                <Input
                  id="sub-expires"
                  type="date"
                  value={expiresBefore}
                  onChange={(event) => {
                    setExpiresBefore(event.target.value);
                  }}
                />
              </div>
              {canBulk ? (
                <>
                  <div className="flex w-28 flex-col gap-1">
                    <Label htmlFor="bulk-days">{t('users.extendDays')}</Label>
                    <Input
                      id="bulk-days"
                      min={1}
                      type="number"
                      value={days}
                      onChange={(event) => {
                        setDays(Number(event.target.value));
                      }}
                    />
                  </div>
                  <Button
                    disabled={selected.length === 0 || selected.length > BULK_LIMIT}
                    onClick={() => {
                      setConfirm(true);
                    }}
                  >
                    {t('subscriptions.bulkExtend')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('subscriptions.selected', { count: selected.length })}
                  </span>
                </>
              ) : null}
            </div>
            {selected.length > BULK_LIMIT ? (
              <p className="text-sm text-danger">{t('subscriptions.limit')}</p>
            ) : null}

            <AdminSection refresh={resource.refresh} state={resource.state}>
              {(data) => (
                <DataTable
                  columns={[
                    ...(canBulk
                      ? [
                          {
                            key: 'select',
                            header: '',
                            cell: (row: List['items'][number]) => (
                              <input
                                aria-label={row.id}
                                checked={selected.includes(row.id)}
                                type="checkbox"
                                onChange={(event) => {
                                  setSelected((current) =>
                                    event.target.checked
                                      ? [...current, row.id]
                                      : current.filter((item) => item !== row.id),
                                  );
                                }}
                              />
                            ),
                          },
                        ]
                      : []),
                    {
                      key: 'user',
                      header: t('subscriptions.user'),
                      cell: (row) => row.userId.slice(0, 8),
                    },
                    {
                      key: 'status',
                      header: t('subscriptions.status'),
                      cell: (row) => row.status,
                    },
                    {
                      key: 'expiresAt',
                      header: t('users.expiresAt'),
                      cell: (row) => new Date(row.expiresAt).toLocaleString('ru'),
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
              )}
            </AdminSection>

            <ConfirmDialog
              labels={{
                cancel: t('cancel'),
                confirm: t('confirm'),
                reasonLabel: t('reason'),
                reasonRequired: t('reasonRequired'),
              }}
              onConfirm={(reason) => {
                setPending(true);
                adminApi()
                  .send('POST', 'api/admin/v1/subscriptions/bulk-extend', z.unknown(), {
                    subscriptionIds: selected,
                    days,
                    reason,
                  })
                  .then(
                    () => {
                      setConfirm(false);
                      setSelected([]);
                      invalidate('admin:subscriptions');
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
              onOpenChange={setConfirm}
              open={confirm}
              pending={pending}
              requireReason
              title={t('subscriptions.bulkExtend')}
            />
          </section>
        );
      }}
    </AdminShell>
  );
}
