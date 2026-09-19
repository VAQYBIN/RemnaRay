'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { invoiceSchema, type InvoiceView } from '@remnaray/domain';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useToast } from '@remnaray/ui';

import { browserApi } from '../../../../lib/api';
import { countdown, money } from '../../../../lib/format';
import { invalidate, useResource } from '../../../../lib/resource';
import { Link } from '../../../../i18n/navigation';
import type { Locale } from '../../../../i18n/routing';
import { ResourceSection, useErrorMessage } from '../../account/states';

/** FR-134: poll every three seconds, for at most thirty minutes. */
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_MS = 30 * 60_000;

const STATUS_LABEL: Record<string, string> = {
  pending: 'pay.statusPending',
  paid: 'pay.statusPaid',
  expired: 'pay.statusExpired',
  canceled: 'pay.statusCanceled',
  underpaid: 'pay.statusUnderpaid',
  failed: 'pay.statusFailed',
};

export default function PayStatus({
  invoiceId,
  locale,
  botUsername,
}: {
  invoiceId: string;
  locale: Locale;
  botUsername: string;
}) {
  const t = useTranslations('account');
  const { toast } = useToast();
  const message = useErrorMessage();
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());

  const resource = useResource<InvoiceView>(`me:invoice:${invoiceId}`, () =>
    browserApi().get(`api/v1/me/invoices/${encodeURIComponent(invoiceId)}`, invoiceSchema),
  );

  const invoice = resource.state.status === 'ready' ? resource.state.data : null;
  const terminal = invoice?.terminal ?? false;

  useEffect(() => {
    const ticker = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(ticker);
    };
  }, []);

  useEffect(() => {
    if (terminal) return undefined;
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        window.clearInterval(timer);
        return;
      }
      invalidate(`me:invoice:${invoiceId}`);
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [invoiceId, startedAt, terminal]);

  const act = useCallback(
    (action: 'check' | 'cancel') => {
      setPending(true);
      browserApi()
        .send(
          'POST',
          `api/v1/me/invoices/${encodeURIComponent(invoiceId)}/${action}`,
          invoiceSchema,
        )
        .then(
          () => {
            invalidate('me');
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
    [invoiceId, message, t, toast],
  );

  return (
    <ResourceSection refresh={resource.refresh} state={resource.state}>
      {(data) => {
        const remaining = new Date(data.expiresAt).getTime() - now;
        const starsLink =
          data.starsInvoiceLink ??
          (botUsername ? `https://t.me/${botUsername}?start=inv_${data.id}` : null);
        return (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle>{t('pay.title')}</CardTitle>
              <Badge variant={data.status === 'paid' ? 'success' : 'secondary'}>
                {t(STATUS_LABEL[data.status] ?? 'pay.statusPending')}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p aria-live="polite" className="text-lg font-semibold">
                {t(STATUS_LABEL[data.status] ?? 'pay.statusPending')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('pay.amount')}: {money(data.amount.amountMinor, data.amount.currency, locale)}
              </p>
              {data.status === 'pending' ? (
                <p aria-live="polite" className="font-mono text-sm">
                  {remaining > 0
                    ? t('pay.deadline', { time: countdown(remaining) })
                    : t('pay.expired')}
                </p>
              ) : null}
              {data.status === 'underpaid' ? (
                <p className="text-sm text-muted-foreground">{t('pay.underpaidHint')}</p>
              ) : null}
              {data.status === 'expired' ? (
                <p className="text-sm text-muted-foreground">{t('pay.toBalance')}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {data.status === 'pending' && data.paymentUrl ? (
                  <a href={data.paymentUrl} rel="noreferrer" target="_blank">
                    <Button>{t('pay.open')}</Button>
                  </a>
                ) : null}
                {data.status === 'pending' && !data.paymentUrl && starsLink ? (
                  <a href={starsLink} rel="noreferrer" target="_blank">
                    <Button>{t('pay.openStars')}</Button>
                  </a>
                ) : null}
                {data.terminal ? null : (
                  <Button
                    disabled={pending}
                    variant="secondary"
                    onClick={() => {
                      act('check');
                    }}
                  >
                    {t('pay.check')}
                  </Button>
                )}
                {data.status === 'pending' ? (
                  <Button
                    disabled={pending}
                    variant="ghost"
                    onClick={() => {
                      act('cancel');
                    }}
                  >
                    {t('pay.cancel')}
                  </Button>
                ) : null}
                {data.status === 'paid' ? (
                  <Link href="/account">
                    <Button>{t('pay.goToSubscription')}</Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      }}
    </ResourceSection>
  );
}

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'INTERNAL_ERROR';
}
