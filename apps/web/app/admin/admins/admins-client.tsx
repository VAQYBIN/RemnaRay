'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { invalidate, useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection, useAdminErrorMessage } from '../admin-states';

const listSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      role: z.string(),
      telegramId: z.string().nullable(),
      isActive: z.boolean(),
      totpEnabled: z.boolean(),
      lastLoginAt: z.string().nullable(),
    }),
  ),
});

export default function AdminsClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [deactivate, setDeactivate] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource('admin:admins', () =>
    adminApi().get('api/admin/v1/admins', listSchema),
  );

  const fail = useCallback(
    (error: unknown) => {
      const code = errorCode(error);
      toast({
        title: t('errorTitle'),
        description: code === 'LAST_ADMIN' ? t('admins.lastAdmin') : message(code),
        variant: 'danger',
      });
    },
    [message, t, toast],
  );

  const run = useCallback(
    (path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') => {
      setPending(true);
      adminApi()
        .send(method, `api/admin/v1/admins/${path}`, z.unknown(), body)
        .then(() => {
          setDeactivate(null);
          invalidate('admin:admins');
          toast({ title: t('saved') });
        }, fail)
        .finally(() => {
          setPending(false);
        });
    },
    [fail, t, toast],
  );

  return (
    <AdminShell>
      {() => (
        <section className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold">{t('admins.title')}</h1>

          <AdminSection refresh={resource.refresh} state={resource.state}>
            {(data) => (
              <DataTable
                columns={[
                  { key: 'email', header: t('admins.email'), cell: (row) => row.email },
                  { key: 'role', header: t('admins.role'), cell: (row) => row.role },
                  {
                    key: 'active',
                    header: t('admins.active'),
                    cell: (row) => (
                      <Badge variant={row.isActive ? 'success' : 'secondary'}>
                        {row.isActive ? '✓' : '✗'}
                      </Badge>
                    ),
                  },
                  {
                    key: 'totp',
                    header: t('admins.totp'),
                    cell: (row) => (row.totpEnabled ? '✓' : '✗'),
                  },
                  {
                    key: 'actions',
                    header: '',
                    cell: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={pending}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            run(`${row.id}/reset-totp`);
                          }}
                        >
                          {t('admins.resetTotp')}
                        </Button>
                        <Button
                          disabled={pending || !row.isActive}
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setDeactivate(row.id);
                          }}
                        >
                          {t('admins.deactivate')}
                        </Button>
                      </div>
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

          <Card>
            <CardHeader>
              <CardTitle>{t('admins.create')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="admin-email">{t('admins.email')}</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="admin-password">{t('admins.password')}</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="admin-role">{t('admins.role')}</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="admin-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">operator</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  disabled={pending || !email || password.length < 12}
                  onClick={() => {
                    setPending(true);
                    adminApi()
                      .send('POST', 'api/admin/v1/admins', z.unknown(), { email, password, role })
                      .then(() => {
                        setEmail('');
                        setPassword('');
                        invalidate('admin:admins');
                        toast({ title: t('saved') });
                      }, fail)
                      .finally(() => {
                        setPending(false);
                      });
                  }}
                >
                  {t('admins.create')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <ConfirmDialog
            destructive
            labels={{
              cancel: t('cancel'),
              confirm: t('confirm'),
              reasonLabel: t('reason'),
              reasonRequired: t('reasonRequired'),
            }}
            onConfirm={(reason) => {
              if (deactivate) run(`${deactivate}/deactivate`, { reason });
            }}
            onOpenChange={(open) => {
              if (!open) setDeactivate(null);
            }}
            open={deactivate !== null}
            pending={pending}
            requireReason
            title={t('admins.deactivateTitle')}
          />
        </section>
      )}
    </AdminShell>
  );
}
