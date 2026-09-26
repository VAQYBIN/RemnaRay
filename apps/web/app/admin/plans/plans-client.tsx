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

const RESET_STRATEGIES = ['NO_RESET', 'DAY', 'WEEK', 'MONTH'] as const;

const squadsSchema = z.object({
  items: z.array(z.object({ uuid: z.string(), name: z.string() })),
});

/** FR-145: every field of a plan the console creates or edits. */
type Draft = {
  slug: string;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  durationDays: number;
  trafficGb: number;
  trafficResetStrategy: string;
  deviceLimit: number;
  squads: string[];
  priceMinor: bigint | null;
  isPublic: boolean;
  isActive: boolean;
};

const emptyDraft: Draft = {
  slug: '',
  nameRu: '',
  nameEn: '',
  descriptionRu: '',
  descriptionEn: '',
  durationDays: 30,
  trafficGb: 0,
  trafficResetStrategy: 'NO_RESET',
  deviceLimit: 3,
  squads: [],
  priceMinor: null,
  isPublic: true,
  isActive: true,
};

function draftOf(plan: AdminPlan): Draft {
  return {
    slug: plan.slug,
    nameRu: plan.name['ru'] ?? '',
    nameEn: plan.name['en'] ?? '',
    descriptionRu: plan.description?.['ru'] ?? '',
    descriptionEn: plan.description?.['en'] ?? '',
    durationDays: plan.durationDays,
    trafficGb: Math.round(plan.trafficLimitBytes / GIGABYTE),
    trafficResetStrategy: plan.trafficResetStrategy,
    deviceLimit: plan.deviceLimit,
    squads: plan.squads,
    priceMinor: BigInt(plan.price.amountMinor),
    isPublic: plan.isPublic,
    isActive: plan.isActive,
  };
}

export default function PlansAdminClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource<AdminPlan[]>('admin:plans', () =>
    adminApi().get('api/admin/v1/plans', adminPlanListSchema, {
      query: { includeInactive: 'true' },
    }),
  );

  const panelSquads = useResource('admin:panel:squads', () =>
    adminApi().get('api/admin/v1/panel/squads', squadsSchema),
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

  const save = useCallback(() => {
    setPending(true);
    const fields = {
      name: { ru: draft.nameRu, en: draft.nameEn },
      description: { ru: draft.descriptionRu, en: draft.descriptionEn },
      durationDays: draft.durationDays,
      trafficLimitBytes: draft.trafficGb * GIGABYTE,
      trafficResetStrategy: draft.trafficResetStrategy,
      deviceLimit: draft.deviceLimit,
      squads: draft.squads,
      priceMinor: Number(draft.priceMinor ?? 0n),
      isPublic: draft.isPublic,
      isActive: draft.isActive,
    };
    (editing
      ? adminApi().send('PATCH', `api/admin/v1/plans/${editing.id}`, z.unknown(), fields)
      : adminApi().send('POST', 'api/admin/v1/plans', z.unknown(), { slug: draft.slug, ...fields })
    )
      .then(() => {
        setDraft(emptyDraft);
        setEditing(null);
        invalidate('admin:plans');
        toast({ title: t('saved') });
      }, fail)
      .finally(() => {
        setPending(false);
      });
  }, [draft, editing, fail, t, toast]);

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
                          key: 'squads',
                          header: t('plans.squadsColumn'),
                          cell: (row) =>
                            row.squads.length > 0 ? (
                              row.squads.length
                            ) : (
                              <Badge variant="danger">{t('plans.noSquads')}</Badge>
                            ),
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
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditing(row);
                                    setDraft(draftOf(row));
                                  }}
                                >
                                  {t('plans.edit')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setDeleteTarget(row.id);
                                  }}
                                >
                                  {t('plans.delete')}
                                </Button>
                              </div>
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
                  <CardTitle>
                    {editing ? t('plans.editTitle', { slug: editing.slug }) : t('plans.create')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field id="slug" label={t('plans.slug')}>
                    <Input
                      disabled={editing !== null}
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
                  <Field id="description-ru" label={t('plans.descriptionRu')}>
                    <Input
                      id="description-ru"
                      value={draft.descriptionRu}
                      onChange={(event) => {
                        setDraft({ ...draft, descriptionRu: event.target.value });
                      }}
                    />
                  </Field>
                  <Field id="description-en" label={t('plans.descriptionEn')}>
                    <Input
                      id="description-en"
                      value={draft.descriptionEn}
                      onChange={(event) => {
                        setDraft({ ...draft, descriptionEn: event.target.value });
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
                  <Field id="reset" label={t('plans.resetStrategy')}>
                    <select
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                      id="reset"
                      value={draft.trafficResetStrategy}
                      onChange={(event) => {
                        setDraft({ ...draft, trafficResetStrategy: event.target.value });
                      }}
                    >
                      {RESET_STRATEGIES.map((strategy) => (
                        <option key={strategy} value={strategy}>
                          {t(`plans.reset.${strategy}`)}
                        </option>
                      ))}
                    </select>
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
                  <fieldset className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                    <legend className="text-sm font-medium">{t('plans.squads')}</legend>
                    {panelSquads.state.status === 'ready' ? (
                      <div className="flex flex-wrap gap-4">
                        {[
                          ...panelSquads.state.data.items,
                          // A squad the panel no longer lists stays visible, so
                          // it can be taken off the plan.
                          ...draft.squads
                            .filter((uuid) =>
                              panelSquads.state.status === 'ready'
                                ? !panelSquads.state.data.items.some((squad) => squad.uuid === uuid)
                                : false,
                            )
                            .map((uuid) => ({ uuid, name: uuid })),
                        ].map((squad) => (
                          <label className="flex items-center gap-2 text-sm" key={squad.uuid}>
                            <input
                              checked={draft.squads.includes(squad.uuid)}
                              type="checkbox"
                              onChange={(event) => {
                                setDraft({
                                  ...draft,
                                  squads: event.target.checked
                                    ? [...new Set([...draft.squads, squad.uuid])]
                                    : draft.squads.filter((uuid) => uuid !== squad.uuid),
                                });
                              }}
                            />
                            {squad.name}
                          </label>
                        ))}
                      </div>
                    ) : panelSquads.state.status === 'error' ? (
                      <p className="text-sm text-destructive">{t('plans.squadsUnavailable')}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{t('plans.squadsHint')}</p>
                  </fieldset>
                  <div className="flex items-end gap-2">
                    <Button
                      disabled={
                        pending ||
                        !draft.slug ||
                        draft.priceMinor === null ||
                        draft.squads.length === 0
                      }
                      onClick={save}
                    >
                      {t('plans.save')}
                    </Button>
                    {editing ? (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setEditing(null);
                          setDraft(emptyDraft);
                        }}
                      >
                        {t('cancel')}
                      </Button>
                    ) : null}
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
