'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';

import { permissions as allPermissions, segmentPresets } from '@remnaray/domain';
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

const broadcastSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  totalCount: z.number(),
  sentCount: z.number(),
  blockedCount: z.number(),
  failedCount: z.number(),
});
const listSchema = z.object({ items: z.array(broadcastSchema) });
const previewSchema = z.object({
  count: z.number(),
  sample: z.array(z.object({ maskedName: z.string() })),
});

const PRESETS = Object.keys(segmentPresets);

export default function BroadcastsClient() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const message = useAdminErrorMessage();
  const [title, setTitle] = useState('');
  const [textRu, setTextRu] = useState('');
  const [textEn, setTextEn] = useState('');
  const [preset, setPreset] = useState<string>('all');
  const [preview, setPreview] = useState<{ id: string; count: number } | null>(null);
  const [pending, setPending] = useState(false);

  const resource = useResource('admin:broadcasts', () =>
    adminApi().get('api/admin/v1/broadcasts', listSchema),
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

  const act = useCallback(
    (id: string, action: string) => {
      setPending(true);
      adminApi()
        .send('POST', `api/admin/v1/broadcasts/${id}/${action}`, z.unknown())
        .then(() => {
          invalidate('admin:broadcasts');
          toast({ title: t('saved') });
        }, fail)
        .finally(() => {
          setPending(false);
        });
    },
    [fail, t, toast],
  );

  const create = useCallback(() => {
    setPending(true);
    adminApi()
      .send('POST', 'api/admin/v1/broadcasts', z.unknown(), {
        title,
        content: {
          text: { ...(textRu ? { ru: textRu } : {}), ...(textEn ? { en: textEn } : {}) },
          buttons: [],
          photo: null,
        },
        segment: segmentPresets[preset] ?? { all: [] },
      })
      .then(() => {
        setTitle('');
        setTextRu('');
        setTextEn('');
        invalidate('admin:broadcasts');
        toast({ title: t('saved') });
      }, fail)
      .finally(() => {
        setPending(false);
      });
  }, [fail, preset, t, textEn, textRu, title, toast]);

  const previewSegment = useCallback(
    (id: string) => {
      adminApi()
        .send('POST', `api/admin/v1/broadcasts/${id}/preview-segment`, previewSchema)
        .then((result) => {
          setPreview({ id, count: result.count });
        }, fail);
    },
    [fail],
  );

  return (
    <AdminShell>
      {(me) => {
        const canWrite =
          allPermissions.includes('broadcasts.write') &&
          me.permissions.includes('broadcasts.write');
        return (
          <section className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">{t('broadcasts.title')}</h1>

            <AdminSection refresh={resource.refresh} state={resource.state}>
              {(data) => (
                <DataTable
                  columns={[
                    { key: 'title', header: t('broadcasts.name'), cell: (row) => row.title },
                    {
                      key: 'status',
                      header: t('broadcasts.status'),
                      cell: (row) => (
                        <Badge
                          variant={
                            row.status === 'done'
                              ? 'success'
                              : row.status === 'running'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {row.status}
                        </Badge>
                      ),
                    },
                    {
                      key: 'progress',
                      header: t('broadcasts.progress'),
                      cell: (row) =>
                        `${row.sentCount.toString()} / ${row.totalCount.toString()} · ${t(
                          'broadcasts.blocked',
                        )} ${row.blockedCount.toString()} · ${t('broadcasts.failed')} ${row.failedCount.toString()}`,
                    },
                    {
                      key: 'actions',
                      header: '',
                      cell: (row) => (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              previewSegment(row.id);
                            }}
                          >
                            {t('broadcasts.preview')}
                          </Button>
                          {canWrite ? (
                            <>
                              <Button
                                disabled={pending}
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  act(row.id, 'test');
                                }}
                              >
                                {t('broadcasts.test')}
                              </Button>
                              {row.status === 'running' ? (
                                <Button
                                  disabled={pending}
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    act(row.id, 'pause');
                                  }}
                                >
                                  {t('broadcasts.pause')}
                                </Button>
                              ) : (
                                <Button
                                  disabled={pending || row.status === 'done'}
                                  size="sm"
                                  onClick={() => {
                                    act(row.id, row.status === 'paused' ? 'resume' : 'start');
                                  }}
                                >
                                  {row.status === 'paused'
                                    ? t('broadcasts.resume')
                                    : t('broadcasts.start')}
                                </Button>
                              )}
                              <Button
                                disabled={pending || row.status === 'done'}
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  act(row.id, 'cancel');
                                }}
                              >
                                {t('broadcasts.cancel')}
                              </Button>
                            </>
                          ) : null}
                          <a download href={`/api/admin/v1/broadcasts/${row.id}/report.csv`}>
                            <Button size="sm" variant="ghost">
                              {t('broadcasts.downloadFailures')}
                            </Button>
                          </a>
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

            {preview ? (
              <p className="text-sm text-muted-foreground">
                {t('broadcasts.previewResult', { count: preview.count })}
              </p>
            ) : null}

            {canWrite ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t('broadcasts.create')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bc-title">{t('broadcasts.name')}</Label>
                    <Input
                      id="bc-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bc-ru">{t('broadcasts.textRu')}</Label>
                    <textarea
                      className="min-h-24 rounded-md border border-border bg-background p-3 text-sm"
                      id="bc-ru"
                      value={textRu}
                      onChange={(event) => {
                        setTextRu(event.target.value);
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="bc-en">{t('broadcasts.textEn')}</Label>
                    <textarea
                      className="min-h-24 rounded-md border border-border bg-background p-3 text-sm"
                      id="bc-en"
                      value={textEn}
                      onChange={(event) => {
                        setTextEn(event.target.value);
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('broadcasts.htmlHint')}</p>
                  <p className="text-xs text-muted-foreground">{t('broadcasts.placeholders')}</p>
                  <div className="flex w-64 flex-col gap-1">
                    <Label htmlFor="bc-preset">{t('broadcasts.preset')}</Label>
                    <Select value={preset} onValueChange={setPreset}>
                      <SelectTrigger id="bc-preset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESETS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {t(`broadcasts.preset.${item}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button disabled={pending || !title || (!textRu && !textEn)} onClick={create}>
                      {t('broadcasts.create')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
        );
      }}
    </AdminShell>
  );
}
