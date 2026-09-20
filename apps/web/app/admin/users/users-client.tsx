'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { z } from 'zod';

import {
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@remnaray/ui';

import { adminApi } from '../../../lib/admin-client';
import { adminUserListSchema } from '../../../lib/admin-contracts';
import { money } from '../../../lib/format';
import { useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection } from '../admin-states';

type UserList = z.infer<typeof adminUserListSchema>;
const STATUSES = ['none', 'provisioning', 'active', 'grace', 'expired', 'revoked'] as const;

export default function UsersClient() {
  const t = useTranslations('admin');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('any');

  const query = useMemo(
    () => ({
      ...(applied ? { q: applied } : {}),
      ...(status === 'any' ? {} : { status }),
      limit: 50,
    }),
    [applied, status],
  );

  const resource = useResource<UserList>(`admin:users:${applied}:${status}`, () =>
    adminApi().get('api/admin/v1/users', adminUserListSchema, { query }),
  );

  return (
    <AdminShell>
      {() => (
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold">{t('users.title')}</h1>

          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(search.trim());
            }}
          >
            <div className="flex w-72 flex-col gap-1">
              <Label htmlFor="user-search">{t('search')}</Label>
              <Input
                id="user-search"
                placeholder={t('users.searchHint')}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </div>
            <div className="flex w-56 flex-col gap-1">
              <Label htmlFor="user-status">{t('users.status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t('users.statusAny')}</SelectItem>
                  {STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === 'none' ? t('users.statusNone') : item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">{t('apply')}</Button>
          </form>

          <AdminSection refresh={resource.refresh} state={resource.state}>
            {(data) => (
              <DataTable
                columns={[
                  {
                    key: 'telegramId',
                    header: t('users.telegramId'),
                    cell: (row) => row.telegramId,
                  },
                  {
                    key: 'username',
                    header: t('users.username'),
                    cell: (row) => row.username ?? row.firstName ?? '—',
                  },
                  {
                    key: 'status',
                    header: t('users.status'),
                    cell: (row) =>
                      row.isBanned ? (
                        <Badge variant="danger">{t('users.banned')}</Badge>
                      ) : (
                        (row.subscriptionStatus ?? '—')
                      ),
                  },
                  {
                    key: 'expiresAt',
                    header: t('users.expiresAt'),
                    cell: (row) =>
                      row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('ru') : '—',
                  },
                  {
                    key: 'balance',
                    header: t('users.balance'),
                    cell: (row) => money(row.balance.amountMinor, row.balance.currency, 'ru'),
                  },
                  {
                    key: 'open',
                    header: '',
                    cell: (row) => (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/admin/users/${row.id}`}>{t('users.open')}</Link>
                      </Button>
                    ),
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
        </section>
      )}
    </AdminShell>
  );
}
