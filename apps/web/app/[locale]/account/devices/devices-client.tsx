'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import { deviceListSchema, type DeviceListView } from '@remnaray/domain';
import { Button, ConfirmDialog, DataTable, useToast } from '@remnaray/ui';
import { z } from 'zod';

import { browserApi } from '../../../../lib/api';
import { invalidate, useResource } from '../../../../lib/resource';
import type { Locale } from '../../../../i18n/routing';
import { AccountHeading } from '../account-chrome';
import { ResourceSection, useErrorMessage } from '../states';

export default function DevicesClient({ locale }: { locale: Locale }) {
  const t = useTranslations('account');
  const common = useTranslations('common');
  const { toast } = useToast();
  const message = useErrorMessage();
  const [target, setTarget] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource<DeviceListView>('me:devices', () =>
    browserApi().get('api/v1/me/subscription/devices', deviceListSchema),
  );

  const remove = useCallback(
    (hwid: string) => {
      setPending(true);
      browserApi()
        .send('DELETE', `api/v1/me/subscription/devices/${encodeURIComponent(hwid)}`, z.unknown())
        .then(
          () => {
            setTarget(null);
            invalidate('me:devices');
          },
          (error: unknown) => {
            toast({
              title: t('errorTitle'),
              description: message(codeOf(error)),
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
    <section>
      <AccountHeading description={t('devices.description')} title={t('devices.title')} />
      <ResourceSection refresh={resource.refresh} state={resource.state}>
        {(data) => (
          <div className="flex flex-col gap-4">
            <DataTable
              columns={[
                { key: 'hwid', header: 'HWID', cell: (row) => row.hwid },
                {
                  key: 'platform',
                  header: t('devices.platform'),
                  cell: (row) => [row.platform, row.deviceModel].filter(Boolean).join(' · ') || '—',
                },
                {
                  key: 'added',
                  header: t('devices.added'),
                  cell: (row) =>
                    row.createdAt ? new Date(row.createdAt).toLocaleString(locale) : '—',
                },
                {
                  key: 'actions',
                  header: '',
                  cell: (row) =>
                    data.canRemove ? (
                      <Button
                        disabled={pending}
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setTarget(row.hwid);
                        }}
                      >
                        {t('devices.remove')}
                      </Button>
                    ) : null,
                },
              ]}
              labels={{
                loadMore: common('more'),
                emptyTitle: t('devices.emptyTitle'),
                emptyDescription: t('devices.emptyDescription'),
                errorTitle: t('errorTitle'),
              }}
              rowKey={(row) => row.hwid}
              rows={data.items}
            />
            {data.canRemove ? null : (
              <p className="text-sm text-muted-foreground">{t('devices.cannotRemove')}</p>
            )}
          </div>
        )}
      </ResourceSection>

      <ConfirmDialog
        description={t('devices.removeDescription')}
        destructive
        labels={{ cancel: common('cancel'), confirm: common('confirm'), reasonLabel: '' }}
        onConfirm={() => {
          if (target) remove(target);
        }}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        open={target !== null}
        pending={pending}
        title={t('devices.removeTitle')}
      />
    </section>
  );
}

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'INTERNAL_ERROR';
}
