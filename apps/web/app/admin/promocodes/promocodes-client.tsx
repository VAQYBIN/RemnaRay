'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { permissions as allPermissions } from '@remnaray/domain';
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
import { useResource, invalidate } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection, useAdminErrorMessage } from '../admin-states';

const promocodeSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.string(),
  value: z.number(),
  maxUses: z.number().nullable(),
  maxUsesPerUser: z.number(),
  usedCount: z.number(),
  validUntil: z.string().nullable(),
  firstPurchaseOnly: z.boolean(),
  isActive: z.boolean(),
});
const listSchema = z.object({
  items: z.array(promocodeSchema),
  nextCursor: z.string().nullable(),
});
const generatedSchema = z.object({ codes: z.array(z.string()) });

const TYPES = ['discount_percent', 'discount_fixed', 'bonus_days', 'bonus_balance'] as const;

export default function PromocodesClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [code, setCode] = useState('');
  const [type, setType] = useState<string>('discount_percent');
  const [value, setValue] = useState(10);
  const [maxUses, setMaxUses] = useState(100);
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource('admin:promocodes', () =>
    adminApi().get('api/admin/v1/promocodes', listSchema, { query: { limit: 100 } }),
  );

  const fail = useCallback(
    (error: unknown) => {
      toast({
        title: t('errorTitle'),
        description: message(errorCode(error)),
        variant: 'danger',
      });
    },
    [message, t, toast],
  );

  const create = useCallback(() => {
    setPending(true);
    adminApi()
      .send('POST', 'api/admin/v1/promocodes', z.unknown(), {
        code,
        type,
        value,
        maxUses,
      })
      .then(() => {
        setCode('');
        invalidate('admin:promocodes');
        toast({ title: t('saved') });
      }, fail)
      .finally(() => {
        setPending(false);
      });
  }, [code, fail, maxUses, t, toast, type, value]);

  const generate = useCallback(() => {
    setPending(true);
    adminApi()
      .send('POST', 'api/admin/v1/promocodes/generate', generatedSchema, {
        count,
        prefix,
        type,
        value,
        maxUses,
      })
      .then((result) => {
        invalidate('admin:promocodes');
        toast({ title: t('promocodes.generated', { count: result.codes.length }) });
      }, fail)
      .finally(() => {
        setPending(false);
      });
  }, [count, fail, maxUses, prefix, t, toast, type, value]);

  return (
    <AdminShell>
      {(me) => {
        const canWrite =
          allPermissions.includes('promocodes.write') &&
          me.permissions.includes('promocodes.write');
        return (
          <section className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">{t('promocodes.title')}</h1>
              <Button asChild variant="secondary">
                <a download href="/api/admin/v1/promocodes/export">
                  {t('promocodes.export')}
                </a>
              </Button>
            </div>

            <AdminSection refresh={resource.refresh} state={resource.state}>
              {(data) => (
                <DataTable
                  columns={[
                    { key: 'code', header: t('promocodes.code'), cell: (row) => row.code },
                    { key: 'type', header: t('promocodes.type'), cell: (row) => row.type },
                    { key: 'value', header: t('promocodes.value'), cell: (row) => row.value },
                    {
                      key: 'used',
                      header: t('promocodes.used'),
                      cell: (row) =>
                        `${row.usedCount.toString()} / ${row.maxUses === null ? '∞' : row.maxUses.toString()}`,
                    },
                    {
                      key: 'validUntil',
                      header: t('promocodes.validUntil'),
                      cell: (row) =>
                        row.validUntil ? new Date(row.validUntil).toLocaleDateString('ru') : '—',
                    },
                    {
                      key: 'status',
                      header: t('promocodes.status'),
                      cell: (row) => (
                        <Badge variant={row.isActive ? 'success' : 'secondary'}>
                          {row.isActive ? 'active' : 'inactive'}
                        </Badge>
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      cell: (row) =>
                        canWrite ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteTarget(row.id);
                            }}
                          >
                            {t('promocodes.delete')}
                          </Button>
                        ) : null,
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

            {canWrite ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('promocodes.create')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-code">{t('promocodes.code')}</Label>
                    <Input
                      id="promo-code"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value.toUpperCase());
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-type">{t('promocodes.type')}</Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger id="promo-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-value">{t('promocodes.value')}</Label>
                    <Input
                      id="promo-value"
                      min={1}
                      type="number"
                      value={value}
                      onChange={(event) => {
                        setValue(Number(event.target.value));
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-max">{t('promocodes.maxUses')}</Label>
                    <Input
                      id="promo-max"
                      min={1}
                      type="number"
                      value={maxUses}
                      onChange={(event) => {
                        setMaxUses(Number(event.target.value));
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button disabled={pending || code.length < 3} onClick={create}>
                      {t('promocodes.create')}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-count">{t('promocodes.count')}</Label>
                    <Input
                      id="promo-count"
                      max={1000}
                      min={1}
                      type="number"
                      value={count}
                      onChange={(event) => {
                        setCount(Number(event.target.value));
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="promo-prefix">{t('promocodes.prefix')}</Label>
                    <Input
                      id="promo-prefix"
                      value={prefix}
                      onChange={(event) => {
                        setPrefix(event.target.value.toUpperCase());
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button disabled={pending} variant="secondary" onClick={generate}>
                      {t('promocodes.generate')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <ConfirmDialog
              destructive
              labels={{ cancel: t('cancel'), confirm: t('confirm'), reasonLabel: '' }}
              onConfirm={() => {
                if (!deleteTarget) return;
                setPending(true);
                adminApi()
                  .send('DELETE', `api/admin/v1/promocodes/${deleteTarget}`, z.unknown())
                  .then(() => {
                    setDeleteTarget(null);
                    invalidate('admin:promocodes');
                    toast({ title: t('saved') });
                  }, fail)
                  .finally(() => {
                    setPending(false);
                  });
              }}
              onOpenChange={(open) => {
                if (!open) setDeleteTarget(null);
              }}
              open={deleteTarget !== null}
              pending={pending}
              title={t('promocodes.deleteTitle')}
            />
          </section>
        );
      }}
    </AdminShell>
  );
}
