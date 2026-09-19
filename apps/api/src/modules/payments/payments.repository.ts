import { Prisma, type PrismaClient } from '@remnaray/db';

import { PaymentError } from './payments.errors';
import type { ProviderEvent } from './payments.types';
import type { Tx } from '../rewards/rewards.types';

/**
 * Money that settles inside a payment transaction and is not part of the
 * payment itself: referral accrual, its reversal and promo-code settlement.
 * Section 15.2 requires these to run in the same transaction as the payment.
 */
export interface RewardHooksPort {
  onPaid(
    tx: Tx,
    source: { id: string; userId: string; type: string; amountMinor: bigint },
  ): Promise<void>;
  onRefund(
    tx: Tx,
    source: { id: string; amountMinor: bigint },
    refundedMinor: bigint,
  ): Promise<void>;
  onInvoiceSettled(tx: Tx, invoiceId: string): Promise<void>;
  onInvoiceReleased(tx: Tx, invoiceId: string): Promise<void>;
}

export type InvoiceInput = {
  userId: string;
  kind: 'purchase' | 'topup' | 'plan_change';
  planId?: string | undefined;
  provider: string;
  amountMinor: bigint;
  currency: string;
  discountMinor?: bigint | undefined;
  promocodeId?: string | undefined;
  idempotencyKey: string;
  expiresAt: Date;
  providerInvoiceId?: string | undefined;
  paymentUrl?: string | undefined;
  starsInvoiceLink?: string | undefined;
  providerPayload?: Record<string, unknown> | undefined;
  providerAmount?: string | undefined;
  providerCurrency?: string | undefined;
  fxRate?: string | undefined;
};

export type StoredEvent = { id: string; duplicate: boolean };

/** Money formatting for notification parameters, in exact minor units. */
function formatMinorRub(amountMinor: bigint): string {
  const units = (amountMinor / 100n).toString();
  const cents = (amountMinor % 100n).toString().padStart(2, '0');
  return `${cents === '00' ? units : `${units},${cents}`} \u20bd`;
}

async function queueNotification(
  tx: Prisma.TransactionClient,
  event: string,
  userId: string,
  dedupKey: string,
  params: Record<string, string> = {},
  subscriptionId?: string,
): Promise<void> {
  await tx.outboxJob.create({
    data: {
      queue: 'notify',
      name: 'notify.send',
      payload: { event, userId, dedupKey, params, ...(subscriptionId ? { subscriptionId } : {}) },
      jobId: `notify:${dedupKey}`,
    },
  });
}

export class PaymentsRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rewards?: RewardHooksPort,
  ) {}

  async findInvoice(id: string) {
    return this.prisma.invoice.findUnique({ where: { id } });
  }

  async findByIdempotencyKey(key: string) {
    return this.prisma.invoice.findUnique({ where: { idempotencyKey: key } });
  }

  async createInvoice(input: InvoiceInput) {
    try {
      return await this.prisma.invoice.create({
        data: {
          userId: input.userId,
          kind: input.kind,
          planId: input.planId ?? null,
          provider: input.provider,
          status: 'pending',
          amountMinor: input.amountMinor,
          currency: input.currency,
          discountMinor: input.discountMinor ?? 0n,
          promocodeId: input.promocodeId ?? null,
          idempotencyKey: input.idempotencyKey,
          expiresAt: input.expiresAt,
          providerInvoiceId: input.providerInvoiceId ?? null,
          paymentUrl: input.paymentUrl ?? null,
          providerPayload: (input.providerPayload ?? {}) as Prisma.InputJsonValue,
          providerAmount: input.providerAmount ?? null,
          providerCurrency: input.providerCurrency ?? null,
          fxRate: input.fxRate ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return this.prisma.invoice.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey },
        });
      throw error;
    }
  }

  async insertEvent(input: {
    provider: string;
    externalId: string;
    invoiceId?: string;
    event: ProviderEvent;
    raw: Record<string, unknown>;
    headers: Record<string, string>;
    signatureOk: boolean;
  }): Promise<StoredEvent> {
    try {
      const row = await this.prisma.paymentEvent.create({
        data: {
          provider: input.provider,
          externalId: input.externalId,
          invoiceId: input.invoiceId ?? null,
          type: input.event.type,
          raw: input.raw as Prisma.InputJsonValue,
          headers: input.headers,
          signatureOk: input.signatureOk,
        },
        select: { id: true },
      });
      return { id: row.id, duplicate: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.paymentEvent.findUniqueOrThrow({
          where: {
            provider_externalId: { provider: input.provider, externalId: input.externalId },
          },
          select: { id: true },
        });
        return { id: row.id, duplicate: true };
      }
      throw error;
    }
  }

  async markEvent(id: string, processedAt: Date, processError?: string): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payment_events SET processed_at = ${processedAt}, process_error = ${processError ?? null}
      WHERE id = ${id}::uuid
    `);
  }

  async expire(now = new Date()): Promise<number> {
    return this.prisma.invoice
      .updateMany({
        where: { status: 'pending', expiresAt: { lt: now } },
        data: { status: 'expired' },
      })
      .then((result) => result.count);
  }

  async settleBalance(invoiceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          amountMinor: bigint;
          planId: string | null;
          status: string;
        }>
      >(
        Prisma.sql`SELECT id, user_id AS "userId", amount_minor AS "amountMinor", plan_id AS "planId", status FROM invoices WHERE id = ${invoiceId}::uuid FOR UPDATE`,
      );
      const invoice = rows[0];
      if (!invoice || invoice.status !== 'pending') return;
      await this.ensureAccount(tx, 'user', invoice.userId, '');
      await this.ensureAccount(tx, 'revenue', invoice.userId, '');
      const accounts = await tx.$queryRaw<Array<{ id: string; kind: string; balance: bigint }>>(
        Prisma.sql`SELECT id, kind, balance_minor AS balance FROM accounts WHERE (kind = 'user'::account_kind AND user_id = ${invoice.userId}::uuid) OR kind = 'revenue'::account_kind ORDER BY id FOR UPDATE`,
      );
      const user = accounts.find((row) => row.kind === 'user');
      const revenue = accounts.find((row) => row.kind === 'revenue');
      if (!user || !revenue || user.balance < invoice.amountMinor)
        throw new Error('INSUFFICIENT_FUNDS');
      const transaction = await tx.transaction.create({
        data: {
          userId: invoice.userId,
          type: 'purchase',
          status: 'completed',
          amountMinor: invoice.amountMinor,
          currency: 'RUB',
          provider: 'balance',
          invoiceId: invoice.id,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: transaction.id,
          debitAccountId: user.id,
          creditAccountId: revenue.id,
          amountMinor: invoice.amountMinor,
          currency: 'RUB',
        },
      });
      await tx.account.update({
        where: { id: user.id },
        data: { balanceMinor: { decrement: invoice.amountMinor } },
      });
      await tx.account.update({
        where: { id: revenue.id },
        data: { balanceMinor: { increment: invoice.amountMinor } },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (invoice.planId)
        await this.activateSubscription(tx, invoice.userId, invoice.planId, false);
      await queueNotification(
        tx,
        'payment.succeeded',
        invoice.userId,
        `payment.succeeded:${invoice.id}`,
        { amount: formatMinorRub(invoice.amountMinor) },
      );
      await this.rewards?.onInvoiceSettled(tx, invoice.id);
      await this.rewards?.onPaid(tx, {
        id: transaction.id,
        userId: invoice.userId,
        type: 'purchase',
        amountMinor: invoice.amountMinor,
      });
      await tx.outboxJob.create({
        data: {
          queue: 'panel',
          name: 'panel.sync-user',
          payload: { userId: invoice.userId, reason: 'paid' },
          jobId: `panel:${invoice.userId}`,
        },
      });
    });
  }

  async refund(transactionId: string, amountMinor: bigint, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          amountMinor: bigint;
          refundedMinor: bigint;
          provider: string | null;
        }>
      >(
        Prisma.sql`SELECT id, user_id AS "userId", amount_minor AS "amountMinor", refunded_minor AS "refundedMinor", provider FROM transactions WHERE id = ${transactionId}::uuid FOR UPDATE`,
      );
      const original = rows[0];
      if (
        !original ||
        amountMinor <= 0n ||
        original.refundedMinor + amountMinor > original.amountMinor
      )
        throw new Error('REFUND_EXCEEDS_PURCHASE');
      await this.ensureAccount(tx, 'revenue', original.userId, '');
      await this.ensureAccount(tx, 'user', original.userId, '');
      const accounts = await tx.$queryRaw<Array<{ id: string; kind: string }>>(
        Prisma.sql`SELECT id, kind FROM accounts WHERE (kind = 'revenue'::account_kind) OR (kind = 'user'::account_kind AND user_id = ${original.userId}::uuid) ORDER BY id FOR UPDATE`,
      );
      const revenue = accounts.find((row) => row.kind === 'revenue');
      const user = accounts.find((row) => row.kind === 'user');
      if (!revenue || !user) throw new Error('ACCOUNT_NOT_FOUND');
      const refund = await tx.transaction.create({
        data: {
          userId: original.userId,
          type: 'refund',
          status: 'completed',
          amountMinor,
          currency: 'RUB',
          provider: original.provider,
          parentId: original.id,
          reason,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          transactionId: refund.id,
          debitAccountId: revenue.id,
          creditAccountId: user.id,
          amountMinor,
          currency: 'RUB',
        },
      });
      await tx.account.update({
        where: { id: revenue.id },
        data: { balanceMinor: { decrement: amountMinor } },
      });
      await tx.account.update({
        where: { id: user.id },
        data: { balanceMinor: { increment: amountMinor } },
      });
      await tx.transaction.update({
        where: { id: original.id },
        data: { refundedMinor: original.refundedMinor + amountMinor },
      });
      await this.rewards?.onRefund(
        tx,
        { id: original.id, amountMinor: original.amountMinor },
        original.refundedMinor + amountMinor,
      );
    });
  }

  async applyEvent(eventId: string): Promise<void> {
    const event = await this.prisma.paymentEvent.findUnique({ where: { id: eventId } });
    if (!event || event.processedAt) return;
    if (!event.signatureOk) {
      await this.markEvent(event.id, new Date(), 'WEBHOOK_INVALID_SIGNATURE');
      return;
    }
    if (!event.invoiceId) {
      await this.markEvent(event.id, new Date(), 'INVOICE_NOT_FOUND');
      return;
    }
    const parsed = event.raw as { providerInvoiceId?: string; paidAmountMinorRub?: string };
    await this.prisma.$transaction(async (tx) => {
      const invoiceRows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          kind: string;
          provider: string;
          status: string;
          amountMinor: bigint;
          expiresAt: Date;
          planId: string | null;
        }>
      >(Prisma.sql`
        SELECT id, user_id AS "userId", kind, provider, status, amount_minor AS "amountMinor",
               expires_at AS "expiresAt", plan_id AS "planId"
        FROM invoices WHERE id = ${event.invoiceId}::uuid FOR UPDATE
      `);
      const invoice = invoiceRows[0];
      if (!invoice) throw new PaymentError('INVOICE_NOT_FOUND');
      if (event.type === 'canceled' && invoice.status === 'pending') {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'canceled' } });
        await this.rewards?.onInvoiceReleased(tx, invoice.id);
      }
      if (event.type === 'paid' && invoice.status !== 'paid') {
        const paid = parsed.paidAmountMinorRub
          ? BigInt(parsed.paidAmountMinorRub)
          : invoice.amountMinor;
        const underpaid = paid * 100n < invoice.amountMinor * 98n;
        const late = invoice.status === 'expired' || invoice.expiresAt < event.receivedAt;
        const credit = paid > 0n ? paid : invoice.amountMinor;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: underpaid ? 'underpaid' : 'paid', paidAt: new Date() },
        });
        const txRow = await tx.transaction.create({
          data: {
            userId: invoice.userId,
            type: underpaid || late || invoice.kind === 'topup' ? 'topup' : 'purchase',
            status: 'completed',
            amountMinor: credit,
            currency: 'RUB',
            provider: invoice.provider,
            invoiceId: invoice.id,
          },
        });
        if (underpaid || late || invoice.kind === 'topup') {
          await this.postEntry(
            tx,
            txRow.id,
            invoice.userId,
            invoice.provider,
            credit,
            'provider_clearing',
            'user',
          );
        } else {
          await this.postEntry(
            tx,
            txRow.id,
            invoice.userId,
            invoice.provider,
            invoice.amountMinor,
            'provider_clearing',
            'user',
          );
          await this.postEntry(
            tx,
            txRow.id,
            invoice.userId,
            invoice.provider,
            invoice.amountMinor,
            'user',
            'revenue',
          );
          if (invoice.planId)
            await this.activateSubscription(
              tx,
              invoice.userId,
              invoice.planId,
              invoice.kind === 'plan_change',
            );
          await tx.outboxJob.create({
            data: {
              queue: 'panel',
              name: 'panel.sync-user',
              payload: { userId: invoice.userId, reason: 'paid' },
              jobId: `panel:${invoice.userId}`,
            },
          });
        }
        if (underpaid || late || invoice.kind === 'topup')
          await queueNotification(
            tx,
            'payment.to_balance',
            invoice.userId,
            `payment.to_balance:${invoice.id}`,
            { amount: formatMinorRub(credit) },
          );
        else
          await queueNotification(
            tx,
            'payment.succeeded',
            invoice.userId,
            `payment.succeeded:${invoice.id}`,
            { amount: formatMinorRub(invoice.amountMinor) },
          );
        if (underpaid || late) {
          await tx.outboxJob.create({
            data: {
              queue: 'notify',
              name: 'notify.alert',
              payload: {
                type: underpaid ? 'payment.underpaid' : 'payment.late',
                details: invoice.id,
              },
              jobId: `alert:${underpaid ? 'payment.underpaid' : 'payment.late'}:${invoice.id}`,
            },
          });
        }
        if (underpaid) await this.rewards?.onInvoiceReleased(tx, invoice.id);
        else await this.rewards?.onInvoiceSettled(tx, invoice.id);
        await this.rewards?.onPaid(tx, {
          id: txRow.id,
          userId: invoice.userId,
          type: txRow.type,
          amountMinor: txRow.amountMinor,
        });
      }
      await tx.$executeRaw(Prisma.sql`
        UPDATE payment_events SET processed_at = now() WHERE id = ${event.id}::uuid
      `);
    });
  }

  private async postEntry(
    tx: Prisma.TransactionClient,
    transactionId: string,
    userId: string,
    provider: string,
    amount: bigint,
    debitKind: string,
    creditKind: string,
  ) {
    await this.ensureAccount(tx, debitKind, userId, provider);
    await this.ensureAccount(tx, creditKind, userId, provider);
    const accounts = await tx.$queryRaw<Array<{ id: string; kind: string }>>(Prisma.sql`
      SELECT id, kind FROM accounts WHERE
        (kind = ${debitKind}::account_kind AND (${debitKind} <> 'user' OR user_id = ${userId}::uuid) AND (${debitKind} <> 'provider_clearing' OR provider = ${provider}))
        OR (kind = ${creditKind}::account_kind AND (${creditKind} <> 'user' OR user_id = ${userId}::uuid) AND (${creditKind} <> 'provider_clearing' OR provider = ${provider}))
      ORDER BY id FOR UPDATE
    `);
    const debit = accounts.find((row) => row.kind === debitKind);
    const credit = accounts.find((row) => row.kind === creditKind);
    if (!debit || !credit) throw new PaymentError('INVOICE_NOT_FOUND', 'Ledger account missing');
    await tx.ledgerEntry.create({
      data: {
        transactionId,
        debitAccountId: debit.id,
        creditAccountId: credit.id,
        amountMinor: amount,
        currency: 'RUB',
      },
    });
    await tx.account.update({
      where: { id: debit.id },
      data: { balanceMinor: { decrement: amount } },
    });
    await tx.account.update({
      where: { id: credit.id },
      data: { balanceMinor: { increment: amount } },
    });
  }

  private async ensureAccount(
    tx: Prisma.TransactionClient,
    kind: string,
    userId: string,
    provider: string,
  ) {
    if (kind === 'user') {
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO accounts (kind, user_id, currency) VALUES ('user'::account_kind, ${userId}::uuid, 'RUB') ON CONFLICT DO NOTHING`,
      );
    } else if (kind === 'provider_clearing') {
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO accounts (kind, provider, currency) VALUES ('provider_clearing'::account_kind, ${provider}, 'RUB') ON CONFLICT DO NOTHING`,
      );
    } else {
      const existing = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM accounts WHERE kind = ${kind}::account_kind AND currency = 'RUB' LIMIT 1`,
      );
      if (!existing[0])
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO accounts (kind, currency) VALUES (${kind}::account_kind, 'RUB')`,
        );
    }
  }

  private async activateSubscription(
    tx: Prisma.TransactionClient,
    userId: string,
    planId: string,
    planChange = false,
  ) {
    const plan = await tx.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive || plan.deletedAt) throw new PaymentError('PLAN_UNAVAILABLE');
    const now = new Date();
    const live = await tx.subscription.findFirst({
      where: { userId, status: { in: ['provisioning', 'active', 'grace'] } },
      orderBy: { expiresAt: 'desc' },
    });
    const base =
      !planChange && live?.status === 'active' && live.expiresAt > now ? live.expiresAt : now;
    const data = {
      planId: plan.id,
      source: 'purchase' as const,
      status: 'active' as const,
      startsAt:
        !planChange && live?.status === 'active' && live.expiresAt > now ? live.startsAt : now,
      expiresAt: new Date(base.getTime() + plan.durationDays * 86_400_000),
      trafficLimitBytes: plan.trafficLimitBytes,
      deviceLimit: plan.deviceLimit,
      squads: plan.squads,
      trafficResetStrategy: plan.trafficResetStrategy,
    };
    const subscription = live
      ? await tx.subscription.update({ where: { id: live.id }, data })
      : await tx.subscription.create({ data: { userId, ...data } });
    await queueNotification(
      tx,
      'sub.activated',
      userId,
      `sub.activated:${subscription.id}:${subscription.expiresAt.toISOString()}`,
      { until: subscription.expiresAt.toISOString().slice(0, 10) },
      subscription.id,
    );
  }
}
