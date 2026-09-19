import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Infrastructure } from '../../infra/infra.module';
import { decryptSetting } from '../settings/settings.crypto';
import type { SettingsService } from '../settings/settings.service';
import { PaymentError } from './payments.errors';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderRegistry } from './payments.registry';

@Injectable()
export class PaymentsService {
  private readonly recheckAt = new Map<string, number>();
  constructor(
    private readonly infra: Infrastructure,
    private readonly repository: PaymentsRepository,
    private readonly providers: PaymentProviderRegistry,
    private readonly settings?: SettingsService,
  ) {}

  async createInvoice(input: {
    userId: string;
    kind: 'purchase' | 'topup' | 'plan_change';
    planId?: string;
    provider: string;
    amountMinor?: bigint;
    idempotencyKey: string;
  }) {
    if (!input.idempotencyKey) throw new PaymentError('IDEMPOTENCY_REQUIRED');
    const existing = await this.repository.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;
    const user = await this.infra.db.user.findUniqueOrThrow({ where: { id: input.userId } });
    let amount = input.amountMinor ?? 0n;
    let description = 'RemnaRay';
    if (input.kind !== 'topup') {
      if (!input.planId) throw new PaymentError('PLAN_UNAVAILABLE');
      const plan = await this.infra.db.plan.findFirst({
        where: { id: input.planId, isActive: true, deletedAt: null },
      });
      if (!plan) throw new PaymentError('PLAN_UNAVAILABLE');
      amount = plan.priceMinor;
      if (input.kind === 'plan_change') {
        const current = await this.infra.db.subscription.findFirst({
          where: { userId: input.userId, status: 'active' },
        });
        const oldPlan = current?.planId
          ? await this.infra.db.plan.findUnique({ where: { id: current.planId } })
          : null;
        if (!current || !oldPlan || current.expiresAt <= new Date())
          throw new PaymentError('PLAN_UNAVAILABLE', 'Plan change is unavailable');
        const remaining = BigInt(
          Math.max(0, Math.floor((current.expiresAt.getTime() - Date.now()) / 1000)),
        );
        const period = BigInt(oldPlan.durationDays) * 86_400n;
        const credit = (oldPlan.priceMinor * remaining + period - 1n) / period;
        amount = plan.priceMinor > credit ? plan.priceMinor - credit : 1n;
      }
      const name = plan.name as Record<string, string>;
      description = name[user.language] ?? name.ru ?? plan.slug;
    }
    if (amount <= 0n) throw new PaymentError('PLAN_UNAVAILABLE', 'Amount must be positive');
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    const provider = this.providers.get(input.provider);
    const config = await this.providerConfig(input.provider);
    const fiscalMode = this.settings ? String(await this.settings.get('fiscal.mode')) : 'none';
    const fiscalEmail = this.settings
      ? String(await this.settings.get('fiscal.fallback_email'))
      : '';
    const params = {
      invoiceId: input.idempotencyKey,
      amountMinor: amount,
      currency: 'RUB' as const,
      description,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        email: user.email ?? undefined,
        language: user.language,
      },
      returnUrl: `https://${process.env.RR_DOMAIN ?? 'localhost'}/pay/success`,
      failUrl: `https://${process.env.RR_DOMAIN ?? 'localhost'}/pay/fail`,
      expiresAt,
      ...(fiscalMode === 'receipt' && provider.capabilities.receipts
        ? {
            receipt: {
              customer: {
                ...(user.email || fiscalEmail ? { email: user.email ?? fiscalEmail } : {}),
              },
              items: [
                {
                  description,
                  quantity: '1.00',
                  amountMinor: amount,
                  vatCode: Number((await this.settings?.get('fiscal.vat_code')) ?? 1),
                  paymentSubject: 'service' as const,
                  paymentMode: 'full_payment' as const,
                },
              ],
            },
          }
        : {}),
    };
    const created = await provider.createInvoice(params, config);
    const invoiceInput = {
      userId: input.userId,
      kind: input.kind,
      ...(input.planId ? { planId: input.planId } : {}),
      provider: input.provider,
      amountMinor: amount,
      currency: 'RUB',
      idempotencyKey: input.idempotencyKey,
      expiresAt: created.expiresAt,
      providerInvoiceId: created.providerInvoiceId,
      ...(created.paymentUrl || created.starsInvoiceLink
        ? { paymentUrl: created.paymentUrl ?? created.starsInvoiceLink }
        : {}),
      providerPayload: created.rawSafe,
      ...(created.providerAmount
        ? {
            providerAmount: created.providerAmount.amount,
            providerCurrency: created.providerAmount.currency,
            fxRate: created.providerAmount.fxRate,
          }
        : {}),
    };
    const invoice = await this.repository.createInvoice(invoiceInput);
    if (input.provider === 'balance') await this.repository.settleBalance(invoice.id);
    if (provider.capabilities.statusPolling && invoice.status === 'pending') {
      await this.infra.db.outboxJob.create({
        data: {
          queue: 'payments',
          name: 'payments.poll-pending',
          payload: { invoiceId: invoice.id },
          jobId: `poll:${invoice.id}`,
        },
      });
    }
    return this.repository.findInvoice(invoice.id);
  }

  async receiveWebhook(
    providerCode: string,
    raw: Buffer,
    headers: Record<string, string>,
    ip: string,
  ) {
    const provider = this.providers.get(providerCode);
    const config = await this.providerConfig(providerCode);
    const verification = provider.verifyWebhook(raw, headers, ip, config);
    const parsedEvent = provider.parseWebhook(raw, config);
    const event =
      parsedEvent && providerCode === 'yookassa'
        ? await provider.fetchStatus(parsedEvent.providerInvoiceId, config)
        : parsedEvent;
    if (!event) throw new PaymentError('WEBHOOK_INVALID_SIGNATURE', 'Invalid event payload');
    const externalId =
      event.eventId ??
      createHash('sha256')
        .update(
          `${providerCode}:${event.providerInvoiceId}:${event.type}:${event.paidAmount?.amount ?? ''}`,
        )
        .digest('hex');
    const invoice = await this.infra.db.invoice.findFirst({
      where: { provider: providerCode, providerInvoiceId: event.providerInvoiceId },
      select: { id: true },
    });
    let parsedRaw: Record<string, unknown>;
    try {
      parsedRaw = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      parsedRaw = Object.fromEntries(new URLSearchParams(raw.toString('utf8')).entries());
    }
    const normalizedRaw = {
      ...parsedRaw,
      ...(event.paidAmountMinorRub !== undefined
        ? { paidAmountMinorRub: event.paidAmountMinorRub.toString() }
        : event.paidAmount?.currency === 'RUB'
          ? { paidAmountMinorRub: toRubMinor(event.paidAmount.amount).toString() }
          : {}),
    };
    const stored = await this.repository.insertEvent({
      provider: providerCode,
      externalId,
      ...(invoice?.id ? { invoiceId: invoice.id } : {}),
      event,
      raw: normalizedRaw,
      headers,
      signatureOk: verification.ok,
    });
    if (!verification.ok)
      throw new PaymentError(
        'WEBHOOK_INVALID_SIGNATURE',
        verification.reason ?? 'Invalid webhook signature',
      );
    if (!stored.duplicate) await this.repository.applyEvent(stored.id);
    if (!stored.duplicate)
      await this.infra.db.outboxJob.create({
        data: {
          queue: 'payments',
          name: 'payments.apply-event',
          payload: { eventId: stored.id },
          jobId: `evt:${stored.id}`,
        },
      });
    return provider.ackResponse();
  }

  async recheck(invoiceId: string) {
    const last = this.recheckAt.get(invoiceId) ?? 0;
    if (Date.now() - last < 10_000) throw new PaymentError('RATE_LIMITED');
    this.recheckAt.set(invoiceId, Date.now());
    const invoice = await this.repository.findInvoice(invoiceId);
    if (!invoice) throw new PaymentError('INVOICE_NOT_FOUND');
    const provider = this.providers.get(invoice.provider);
    const event = await provider.fetchStatus(
      invoice.providerInvoiceId ?? invoice.id,
      await this.providerConfig(invoice.provider),
    );
    const stored = await this.repository.insertEvent({
      provider: invoice.provider,
      externalId: event.eventId ?? `poll:${invoice.id}:${event.type}`,
      invoiceId: invoice.id,
      event,
      raw: {
        providerInvoiceId: event.providerInvoiceId,
        type: event.type,
        paidAmountMinorRub: event.paidAmountMinorRub?.toString(),
      },
      headers: { source: 'poll' },
      signatureOk: true,
    });
    if (!stored.duplicate) await this.repository.applyEvent(stored.id);
    return this.repository.findInvoice(invoiceId);
  }

  expire() {
    return this.repository.expire();
  }
  async pollPending() {
    const invoices = await this.infra.db.invoice.findMany({
      where: {
        status: 'pending',
        provider: { in: ['platega', 'cryptobot', 'yookassa', 'lava', 'robokassa'] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    for (const invoice of invoices) {
      try {
        await this.recheck(invoice.id);
      } catch {
        /* the next poll retries transient provider failures */
      }
    }
    return invoices.length;
  }
  applyEvent(eventId: string) {
    return this.repository.applyEvent(eventId);
  }
  refund(transactionId: string, amountMinor: bigint, reason: string) {
    return this.repository.refund(transactionId, amountMinor, reason);
  }

  private async providerConfig(code: string): Promise<Record<string, unknown>> {
    const row = await this.infra.db.paymentProvider.findUnique({ where: { code } });
    if (!row?.enabled && code !== 'mock' && code !== 'balance')
      throw new PaymentError('PROVIDER_UNAVAILABLE');
    if (!row?.configEnc) return {};
    return decryptSetting(
      JSON.parse(row.configEnc) as unknown,
      process.env.RR_APP_KEY ?? '',
    ) as Record<string, unknown>;
  }
}

function toRubMinor(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}
