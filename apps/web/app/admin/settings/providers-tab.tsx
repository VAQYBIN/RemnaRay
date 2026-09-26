'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Input,
  Label,
} from '@remnaray/ui';

import {
  complete,
  initialValues,
  ProviderFields,
  providerFieldSchema,
  toConfig,
  type ProviderValues,
} from '../../_components/provider-fields';
import { adminApi } from '../../../lib/admin-client';
import { invalidate } from '../../../lib/resource';

export const providersSchema = z.object({
  items: z.array(
    z.object({
      code: z.string(),
      enabled: z.boolean(),
      sortOrder: z.number(),
      kind: z.string(),
      displayName: z.record(z.string(), z.string()).default({}),
      fields: z.array(providerFieldSchema).default([]),
      config: z.record(z.string(), z.unknown()).default({}),
      lastHealthcheckAt: z.string().nullable(),
      lastHealthcheckOk: z.boolean().nullable(),
      lastHealthcheckError: z.string().nullable(),
      offeredToUsers: z.boolean(),
    }),
  ),
});
type Provider = z.infer<typeof providersSchema>['items'][number];

const healthSchema = z.object({
  enabled: z.boolean(),
  health: z.object({ ok: z.boolean(), error: z.string().optional() }),
});

/**
 * FR-061 in the console: each provider is configured through the form its
 * `configSchema` describes (the same one the setup wizard draws), enabled or
 * disabled, renamed for customers and reordered — no raw JSON.
 */
export function ProvidersTab({
  providers,
  pending,
  setPending,
  fail,
  notify,
}: {
  providers: Provider[];
  pending: boolean;
  setPending: (value: boolean) => void;
  fail: (error: unknown) => void;
  notify: (title: string) => void;
}) {
  const t = useTranslations('admin');
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState<ProviderValues>({});
  const [enabled, setEnabled] = useState(false);
  const [names, setNames] = useState({ ru: '', en: '' });

  const name = (code: string) =>
    t.has(`providers.name.${code}`) ? t(`providers.name.${code}`) : code;
  const label = (key: string) =>
    t.has(`providers.field.${key}`) ? t(`providers.field.${key}`) : key;
  const hint = (key: string) =>
    t.has(`providers.hint.${key}`) ? t(`providers.hint.${key}`) : undefined;

  const run = (task: () => Promise<unknown>) => {
    setPending(true);
    task()
      .then(() => {
        invalidate('admin:settings');
      }, fail)
      .finally(() => {
        setPending(false);
      });
  };

  const open = (provider: Provider) => {
    setEditing(provider.code);
    setEnabled(provider.enabled);
    setNames({
      ru: provider.displayName['ru'] ?? name(provider.code),
      en: provider.displayName['en'] ?? name(provider.code),
    });
    setValues(initialValues(provider.fields, provider.config));
  };

  const move = (code: string, offset: number) => {
    const codes = providers.map((provider) => provider.code);
    const index = codes.indexOf(code);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= codes.length) return;
    [codes[index], codes[target]] = [codes[target] ?? code, code];
    run(() => adminApi().send('POST', 'api/admin/v1/providers/reorder', z.unknown(), { codes }));
  };

  const current = providers.find((provider) => provider.code === editing);
  const storedSecrets = current
    ? current.fields
        .filter((field) => field.secret && current.config[field.key] !== undefined)
        .map((field) => field.key)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('providers.needsHealthcheck')}</p>
      <DataTable
        columns={[
          { key: 'code', header: t('providers.code'), cell: (row) => name(row.code) },
          {
            key: 'enabled',
            header: t('providers.enabled'),
            cell: (row) => (row.enabled ? '✓' : '✗'),
          },
          {
            key: 'health',
            header: t('providers.health'),
            cell: (row) => (
              <Badge
                variant={
                  row.lastHealthcheckOk === true
                    ? 'success'
                    : row.lastHealthcheckOk === false
                      ? 'danger'
                      : 'secondary'
                }
              >
                {row.lastHealthcheckOk === null ? '—' : row.lastHealthcheckOk ? 'ok' : 'fail'}
              </Badge>
            ),
          },
          {
            key: 'offered',
            header: t('providers.offered'),
            cell: (row) => (row.offeredToUsers ? '✓' : '✗'),
          },
          {
            key: 'lastCheck',
            header: t('providers.lastCheck'),
            cell: (row) =>
              row.lastHealthcheckAt ? new Date(row.lastHealthcheckAt).toLocaleString('ru') : '—',
          },
          {
            key: 'actions',
            header: '',
            cell: (row) => (
              <div className="flex flex-wrap gap-1">
                <Button
                  aria-label={t('providers.moveUp')}
                  disabled={pending}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    move(row.code, -1);
                  }}
                >
                  ↑
                </Button>
                <Button
                  aria-label={t('providers.moveDown')}
                  disabled={pending}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    move(row.code, 1);
                  }}
                >
                  ↓
                </Button>
                <Button
                  disabled={pending}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    open(row);
                  }}
                >
                  {t('providers.configure')}
                </Button>
                <Button
                  disabled={pending}
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    run(() =>
                      adminApi().send(
                        'POST',
                        `api/admin/v1/providers/${row.code}/healthcheck`,
                        z.unknown(),
                      ),
                    );
                  }}
                >
                  {t('providers.healthcheck')}
                </Button>
              </div>
            ),
          },
        ]}
        labels={{ loadMore: t('more'), emptyTitle: t('empty'), errorTitle: t('errorTitle') }}
        rowKey={(row) => row.code}
        rows={providers}
      />

      {current ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('providers.configTitle', { provider: name(current.code) })}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={enabled}
                type="checkbox"
                onChange={(event) => {
                  setEnabled(event.target.checked);
                }}
              />
              {t('providers.enabled')}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="provider-name-ru">{t('providers.displayNameRu')}</Label>
                <Input
                  id="provider-name-ru"
                  value={names.ru}
                  onChange={(event) => {
                    setNames({ ...names, ru: event.target.value });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="provider-name-en">{t('providers.displayNameEn')}</Label>
                <Input
                  id="provider-name-en"
                  value={names.en}
                  onChange={(event) => {
                    setNames({ ...names, en: event.target.value });
                  }}
                />
              </div>
            </div>
            <ProviderFields
              fields={current.fields}
              hint={hint}
              idPrefix={`provider-${current.code}`}
              keepSecretHint={t('providers.keepSecret')}
              label={label}
              storedSecrets={storedSecrets}
              values={values}
              onChange={setValues}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={
                  pending ||
                  !names.ru.trim() ||
                  !names.en.trim() ||
                  !complete(current.fields, values, storedSecrets)
                }
                onClick={() => {
                  run(() =>
                    adminApi()
                      .send('PUT', `api/admin/v1/providers/${current.code}`, healthSchema, {
                        enabled,
                        displayName: { ru: names.ru.trim(), en: names.en.trim() },
                        config: toConfig(current.fields, values),
                      })
                      .then((result) => {
                        notify(
                          t('providers.saved', {
                            result: result.health.ok ? 'ok' : (result.health.error ?? 'fail'),
                          }),
                        );
                        setEditing(null);
                      }),
                  );
                }}
              >
                {t('providers.save')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                }}
              >
                {t('providers.close')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
