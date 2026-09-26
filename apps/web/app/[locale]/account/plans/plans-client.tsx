'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  invoiceSchema,
  paymentMethodsSchema,
  planListSchema,
  promocodePreviewSchema,
  type PaymentMethodsView,
  type PlanPublicView,
} from '@remnaray/domain';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  useToast,
} from '@remnaray/ui';

import { browserApi } from '../../../../lib/api';
import { bytes, money } from '../../../../lib/format';
import { invalidate, useResource } from '../../../../lib/resource';
import { useRouter } from '../../../../i18n/navigation';
import type { Locale } from '../../../../i18n/routing';
import { AccountHeading } from '../account-chrome';
import { Empty, ResourceSection, useErrorMessage } from '../states';

type Catalog = { plans: PlanPublicView[]; methods: PaymentMethodsView };

export default function PlansClient({ locale }: { locale: Locale }) {
  const t = useTranslations('account');
  const { toast } = useToast();
  const message = useErrorMessage();
  const router = useRouter();
  const [provider, setProvider] = useState('');
  const [promocode, setPromocode] = useState('');
  // Per plan: the discounted price, or the code the API refused it with.
  const [previews, setPreviews] = useState<
    Record<string, { discount: number; final: number } | { error: string }>
  >({});
  const [pending, setPending] = useState(false);

  const catalog = useResource<Catalog>('me:plans', async () => {
    const api = browserApi();
    const [plans, methods] = await Promise.all([
      api.get('api/v1/public/plans', planListSchema),
      api.get('api/v1/me/payment-methods', paymentMethodsSchema),
    ]);
    return { plans: plans.items, methods };
  });

  /**
   * Section 15.5 preview is per plan; one «Применить» next to the field asks
   * it for every plan at once, and each card shows its own answer.
   */
  const applyPromocode = useCallback(
    (planIds: string[]) => {
      setPending(true);
      const api = browserApi();
      void Promise.allSettled(
        planIds.map((planId) =>
          api.send('POST', 'api/v1/me/promocodes/preview', promocodePreviewSchema, {
            code: promocode,
            planId,
          }),
        ),
      )
        .then((results) => {
          const next: typeof previews = {};
          results.forEach((result, index) => {
            const planId = planIds[index];
            if (!planId) return;
            next[planId] =
              result.status === 'fulfilled'
                ? { discount: result.value.discountMinor, final: result.value.finalMinor }
                : { error: codeOf(result.reason) };
          });
          setPreviews(next);
          const rejected = results.filter((result) => result.status === 'rejected');
          if (rejected.length === results.length && rejected[0])
            toast({
              title: t('errorTitle'),
              description: message(codeOf(rejected[0].reason)),
              variant: 'danger',
            });
        })
        .finally(() => {
          setPending(false);
        });
    },
    [message, promocode, t, toast],
  );

  const pay = useCallback(
    (planId: string, method: string) => {
      setPending(true);
      browserApi()
        .send(
          'POST',
          'api/v1/me/invoices',
          invoiceSchema,
          {
            kind: 'purchase',
            planId,
            provider: method,
            ...(promocode ? { promocode } : {}),
          },
          { headers: { 'idempotency-key': crypto.randomUUID() } },
        )
        .then(
          (invoice) => {
            invalidate('me');
            if (invoice.status === 'paid') router.push('/account');
            else router.push(`/pay/${invoice.id}`);
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
    [message, promocode, router, t, toast],
  );

  return (
    <section>
      <AccountHeading description={t('plans.description')} title={t('plans.title')} />
      <ResourceSection
        empty={<Empty description={t('plans.emptyDescription')} title={t('plans.emptyTitle')} />}
        isEmpty={(data) => data.plans.length === 0}
        refresh={catalog.refresh}
        state={catalog.state}
      >
        {(data) => {
          const methods = [...data.methods.items].sort((left, right) =>
            left.kind === 'balance' ? -1 : right.kind === 'balance' ? 1 : 0,
          );
          const selected = provider || methods.find((item) => item.available)?.code || '';
          return (
            <div className="flex flex-col gap-6">
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold">{t('plans.provider')}</legend>
                <div className="flex flex-wrap gap-3">
                  {methods.map((method) => (
                    <label className="flex items-center gap-2 text-sm" key={method.code}>
                      <input
                        checked={selected === method.code}
                        disabled={!method.available}
                        name="provider"
                        type="radio"
                        value={method.code}
                        onChange={() => {
                          setProvider(method.code);
                        }}
                      />
                      <span>
                        {method.kind === 'balance' && method.balance
                          ? t('plans.balance', {
                              balance: money(
                                method.balance.amountMinor,
                                method.balance.currency,
                                locale,
                              ),
                            })
                          : method.displayName[locale]}
                      </span>
                      {method.available ? null : (
                        <span className="text-xs text-muted-foreground">
                          {t('plans.unavailable')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="promocode">{t('plans.promocode')}</Label>
                  <Input
                    autoComplete="off"
                    id="promocode"
                    value={promocode}
                    onChange={(event) => {
                      setPromocode(event.target.value.toUpperCase());
                      setPreviews({});
                    }}
                  />
                </div>
                <Button
                  disabled={pending || !promocode.trim()}
                  variant="secondary"
                  onClick={() => {
                    applyPromocode(data.plans.map((plan) => plan.id));
                  }}
                >
                  {t('plans.promocodeApply')}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {data.plans.map((plan) => (
                  <Card key={plan.id}>
                    <CardHeader>
                      <CardTitle>{plan.name[locale] || plan.slug}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="text-2xl font-bold">
                        {money(plan.price.amountMinor, plan.price.currency, locale)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('plans.days', { days: plan.durationDays })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {plan.trafficLimitBytes === 0
                          ? t('plans.unlimited')
                          : t('plans.traffic', { traffic: bytes(plan.trafficLimitBytes) })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('plans.devices', { count: plan.deviceLimit })}
                      </p>
                      {(() => {
                        const preview = previews[plan.id];
                        if (!preview) return null;
                        return 'error' in preview ? (
                          <p className="text-sm text-muted-foreground">{message(preview.error)}</p>
                        ) : (
                          <p className="text-sm font-medium text-success">
                            {t('plans.promocodeResult', {
                              discount: money(preview.discount, plan.price.currency, locale),
                              final: money(preview.final, plan.price.currency, locale),
                            })}
                          </p>
                        );
                      })()}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          disabled={pending || !selected}
                          onClick={() => {
                            pay(plan.id, selected);
                          }}
                        >
                          {t('plans.pay')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        }}
      </ResourceSection>
    </section>
  );
}

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'INTERNAL_ERROR';
}
