'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { permissions as allPermissions } from '@remnaray/domain';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  DataTable,
  Input,
  Label,
  MoneyInput,
  useToast,
} from '@remnaray/ui';

import { adminApi, errorCode } from '../../../lib/admin-client';
import { adminPlanListSchema, type AdminPlan } from '../../../lib/admin-contracts';
import { money } from '../../../lib/format';
import { invalidate, useResource } from '../../../lib/resource';
import { AdminShell } from '../admin-shell';
import { AdminSection, useAdminErrorMessage } from '../admin-states';

const GIGABYTE = 1024 ** 3;

type Draft = {
  slug: string;
  nameRu: string;
  nameEn: string;
  durationDays: number;
  trafficGb: number;
  deviceLimit: number;
  priceMinor: bigint | null;
  isPublic: boolean;
  isActive: boolean;
};

const emptyDraft: Draft = {
  slug: '',
  nameRu: '',
  nameEn: '',
  durationDays: 30,
  trafficGb: 0,
  deviceLimit: 3,
  priceMinor: null,
  isPublic: true,
  isActive: true,
};

export default function PlansAdminClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [order, setOrder] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource<AdminPlan[]>('admin:plans', () =>
    adminApi().get('api/admin/v1/plans', adminPlanListSchema, {
      query: { includeInactive: 'true' },
    }),
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
      .send('POST', 'api/admin/v1/plans', z.unknown(), {
        slug: draft.slug,
        name: { ru: draft.nameRu, en: draft.nameEn },
        durationDays: draft.durationDays,
        trafficLimitBytes: draft.trafficGb * GIGABYTE,
        deviceLimit: draft.deviceLimit,
        squads: [],
        priceMinor: Number(draft.priceMinor ?? 0n),
        isPublic: draft.isPublic,
        isActive: draft.isActive,
      })
      .then(() => {
        setDraft(emptyDraft);
        invalidate('admin:plans');
        toast({ title: t('saved') });
      }, fail)
      .finally(() => {
        setPending(false);
      });
  }, [draft, fail, t, toast]);

  const saveOrder = useCallback(
    (ids: string[]) => {
      setPending(true);
      adminApi()
        .send('POST', 'api/admin/v1/plans/reorder', z.unknown(), { ids })
        .then(() => {
          setOrder(null);
          invalidate('admin:plans');
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
      {(me) => {
        const canWrite =
          allPermissions.includes('plans.write') && me.permissions.includes('plans.write');
        return (
          <section className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">{t('plans.title')}</h1>

            <AdminSection refresh={resource.refresh} state={resource.state}>
              {(plans) => {
                const ids = order ?? plans.map((plan) => plan.id);
                const sorted = ids.flatMap((id) => plans.filter((plan) => plan.id === id));
                const move = (index: number, delta: number) => {
                  const next = [...ids];
                  const target = index + delta;
                  if (target < 0 || target >= next.length) return;
                  const [moved] = next.splice(index, 1);
                  if (moved) next.splice(target, 0, moved);
                  setOrder(next);
                };
                return (
                  <div className="flex flex-col gap-4">
                    <DataTable
                      columns={[
                        { key: 'slug', header: t('plans.slug'), cell: (row) => row.slug },
                        {
                          key: 'name',
                          header: t('plans.nameRu'),
                          cell: (row) => row.name['ru'] ?? row.slug,
                        },
                        {
                          key: 'duration',
                          header: t('plans.durationDays'),
                          cell: (row) => row.durationDays,
                        },
                        {
                          key: 'price',
                          header: t('plans.price'),
                          cell: (row) => money(row.price.amountMinor, row.price.currency, 'ru'),
                        },
                        {
                          key: 'flags',
                          header: `${t('plans.isPublic')} / ${t('plans.isActive')}`,
                          cell: (row) =>
                            `${row.isPublic ? '✓' : '✗'} / ${row.isActive ? '✓' : '✗'}`,
                        },
                        {
                          key: 'order',
                          header: t('plans.sortOrder'),
                          cell: (row) =>
                            canWrite ? (
                              <div className="flex gap-1">
                                <Button
                                  aria-label={t('plans.moveUp')}
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    move(ids.indexOf(row.id), -1);
                                  }}
                                >
                                  ↑
                                </Button>
                                <Button
                                  aria-label={t('plans.moveDown')}
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    move(ids.indexOf(row.id), 1);
                                  }}
                                >
                                  ↓
                                </Button>
                              </div>
                            ) : (
                              row.sortOrder
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
                                {t('plans.delete')}
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
                      rows={sorted}
                    />
                    {order && canWrite ? (
                      <div>
                        <Button
                          disabled={pending}
                          onClick={() => {
                            saveOrder(order);
                          }}
                        >
                          {t('plans.reorder')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              }}
            </AdminSection>

            {canWrite ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('plans.create')}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="slug" label={t('plans.slug')}>
                    <Input
                      id="slug"
                      value={draft.slug}
                      onChange={(event) => {
                        setDraft({ ...draft, slug: event.target.value });
                      }}
                    />
                  </Field>
                  <Field id="name-ru" label={t('plans.nameRu')}>
                    <Input
                      id="name-ru"
                      value={draft.nameRu}
                      onChange={(event) => {
                        setDraft({ ...draft, nameRu: event.target.value });
                      }}
                    />
                  </Field>
                  <Field id="name-en" label={t('plans.nameEn')}>
                    <Input
                      id="name-en"
                      value={draft.nameEn}
                      onChange={(event) => {
                        setDraft({ ...draft, nameEn: event.target.value });
                      }}
                    />
                  </Field>
                  <Field id="duration" label={t('plans.durationDays')}>
                    <Input
                      id="duration"
                      min={1}
                      type="number"
                      value={draft.durationDays}
                      onChange={(event) => {
                        setDraft({ ...draft, durationDays: Number(event.target.value) });
                      }}
                    />
                  </Field>
                  <Field id="traffic" label={t('plans.trafficGb')}>
                    <Input
                      id="traffic"
                      min={0}
                      type="number"
                      value={draft.trafficGb}
                      onChange={(event) => {
                        setDraft({ ...draft, trafficGb: Number(event.target.value) });
                      }}
                    />
                  </Field>
                  <Field id="devices" label={t('plans.deviceLimit')}>
                    <Input
                      id="devices"
                      min={1}
                      type="number"
                      value={draft.deviceLimit}
                      onChange={(event) => {
                        setDraft({ ...draft, deviceLimit: Number(event.target.value) });
                      }}
                    />
                  </Field>
                  <Field id="price" label={t('plans.price')}>
                    <MoneyInput
                      id="price"
                      valueMinor={draft.priceMinor}
                      onValueChange={(value) => {
                        setDraft({ ...draft, priceMinor: value });
                      }}
                    />
                  </Field>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={draft.isPublic}
                        type="checkbox"
                        onChange={(event) => {
                          setDraft({ ...draft, isPublic: event.target.checked });
                        }}
                      />
                      {t('plans.isPublic')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={draft.isActive}
                        type="checkbox"
                        onChange={(event) => {
                          setDraft({ ...draft, isActive: event.target.checked });
                        }}
                      />
                      {t('plans.isActive')}
                    </label>
                  </div>
                  <div className="flex items-end">
                    <Button
                      disabled={pending || !draft.slug || draft.priceMinor === null}
                      onClick={create}
                    >
                      {t('plans.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <ConfirmDialog
              description={t('plans.deleteDescription')}
              destructive
              labels={{ cancel: t('cancel'), confirm: t('confirm'), reasonLabel: '' }}
              onConfirm={() => {
                if (!deleteTarget) return;
                setPending(true);
                adminApi()
                  .send('DELETE', `api/admin/v1/plans/${deleteTarget}`, z.unknown())
                  .then(() => {
                    setDeleteTarget(null);
                    invalidate('admin:plans');
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
              title={t('plans.deleteTitle')}
            />
          </section>
        );
      }}
    </AdminShell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
