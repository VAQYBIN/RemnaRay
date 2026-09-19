'use client';

import { useTranslations } from 'next-intl';

import { referralListSchema, referralsSchema, type ReferralsView } from '@remnaray/domain';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  Stat,
  useToast,
} from '@remnaray/ui';

import { browserApi } from '../../../../lib/api';
import { money } from '../../../../lib/format';
import { useResource } from '../../../../lib/resource';
import type { Locale } from '../../../../i18n/routing';
import { AccountHeading } from '../account-chrome';
import { ResourceSection } from '../states';

type ReferralList = {
  items: { maskedName: string; joinedAt: string; status: string; rewardMinor: number }[];
  nextCursor: string | null;
};
type Data = { summary: ReferralsView; list: ReferralList };

export default function ReferralsClient({ locale }: { locale: Locale }) {
  const t = useTranslations('account');
  const common = useTranslations('common');
  const { toast } = useToast();

  const resource = useResource<Data>('me:referrals', async () => {
    const api = browserApi();
    const [summary, list] = await Promise.all([
      api.get('api/v1/me/referrals', referralsSchema),
      api.get('api/v1/me/referrals/list', referralListSchema, { query: { limit: 20 } }),
    ]);
    return { summary, list };
  });

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      toast({ title: common('copied') });
    });
  };

  return (
    <section>
      <AccountHeading description={t('referrals.description')} title={t('referrals.title')} />
      <ResourceSection refresh={resource.refresh} state={resource.state}>
        {(data) => (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label={t('referrals.invited')} value={data.summary.invited} />
              <Stat label={t('referrals.converted')} value={data.summary.converted} />
              <Stat
                label={t('referrals.earned')}
                value={money(data.summary.earned.amountMinor, data.summary.earned.currency, locale)}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('referrals.siteLink')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="break-all rounded-md border border-border bg-background p-3 font-mono text-sm">
                  {data.summary.link}
                </p>
                <p className="break-all rounded-md border border-border bg-background p-3 font-mono text-sm">
                  {data.summary.botLink}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      copy(data.summary.link);
                    }}
                  >
                    {common('copy')}
                  </Button>
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(data.summary.botLink)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Button variant="secondary">{t('referrals.share')}</Button>
                  </a>
                </div>
                <p className="text-sm text-muted-foreground">
                  {data.summary.program.mode === 'fixed'
                    ? t('referrals.termsFixed', {
                        amount: money(data.summary.program.fixedMinor, 'RUB', locale),
                      })
                    : t('referrals.termsPercent', { percent: data.summary.program.percent })}
                </p>
              </CardContent>
            </Card>

            <div>
              <h2 className="mb-3 text-lg font-semibold">{t('referrals.list')}</h2>
              <DataTable
                columns={[
                  {
                    key: 'name',
                    header: t('referrals.list'),
                    cell: (row) => row.maskedName,
                  },
                  {
                    key: 'status',
                    header: t('subscription.status'),
                    cell: (row) =>
                      t.has(`referrals.status.${row.status}`)
                        ? t(`referrals.status.${row.status}`)
                        : row.status,
                  },
                  {
                    key: 'reward',
                    header: t('referrals.earned'),
                    cell: (row) => money(row.rewardMinor, 'RUB', locale),
                  },
                ]}
                labels={{
                  loadMore: common('more'),
                  emptyTitle: t('referrals.emptyTitle'),
                  emptyDescription: t('referrals.emptyDescription'),
                  errorTitle: t('errorTitle'),
                }}
                rowKey={(row) => `${row.maskedName}-${row.joinedAt}`}
                rows={data.list.items}
              />
            </div>
          </div>
        )}
      </ResourceSection>
    </section>
  );
}
