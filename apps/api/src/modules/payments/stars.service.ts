import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { Infrastructure } from '../../infra/infra.module';
import { ApiError } from '../me/me.errors';
import { PaymentsRepository } from './payments.repository';

const PAYLOAD = /^inv_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/u;

const telegramId = z.union([z.number().int().positive(), z.string().regex(/^\d{1,20}$/u)]);

/** Section 9.5 `POST /api/internal/v1/stars/precheckout`, with the amount to compare. */
const precheckoutSchema = z.object({
  telegramId,
  invoicePayload: z.string().min(1).max(128),
  totalAmount: z.number().int().positive(),
  currency: z.string().min(1).max(8),
});

/** Section 9.5 `POST /api/internal/v1/stars/successful-payment`. */
const successfulPaymentSchema = z.object({
  telegramId,
  telegramPaymentChargeId: z.string().min(1).max(256),
  providerPaymentChargeId: z.string().max(256).optional(),
  invoicePayload: z.string().min(1).max(128),
  totalAmount: z.number().int().positive(),
  currency: z.literal('XTR'),
});

const createLinkSchema = z.object({ invoiceId: z.uuid() });

type StarsInvoice = {
  id: string;
  userId: string;
  provider: string;
  status: string;
  amountMinor: bigint;
  providerAmount: { equals(value: number): boolean; toFixed(places: number): string } | null;
  providerInvoiceId: string | null;
  paymentUrl: string | null;
  providerPayload: unknown;
  expiresAt: Date;
};

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError('INVALID_BODY', HttpStatus.BAD_REQUEST);
  return result.data;
}

function conflict(code: string): ApiError {
  return new ApiError(code, HttpStatus.CONFLICT);
}

/**
 * Section 11.3.6. Telegram Stars have no HTTP webhook: `pre_checkout_query`
 * and `successful_payment` reach the shop as updates of the bot, which is
 * already authenticated by the webhook secret or its own token, and are handed
 * to these internal endpoints behind the internal token.
 */
@Injectable()
export class StarsService {
  constructor(
    private readonly infra: Infrastructure,
    private readonly repository: PaymentsRepository,
  ) {}

  /** `stars/create-link`: what the bot needs to `sendInvoice` for `/start inv_<id>`. */
  async invoiceForBot(actingUser: string | undefined, body: unknown) {
    if (!actingUser || !/^\d{1,20}$/u.test(actingUser))
      throw new ApiError('FORBIDDEN', HttpStatus.FORBIDDEN);
    const input = parse(createLinkSchema, body);
    const invoice = await this.ownInvoice(`inv_${input.invoiceId}`, actingUser);
    const failure = this.unpayable(invoice);
    if (failure) throw conflict(failure);
    const stored = (invoice.providerPayload ?? {}) as Record<string, unknown>;
    const title = typeof stored.title === 'string' ? stored.title : 'RemnaRay';
    return {
      invoiceId: invoice.id,
      link: invoice.paymentUrl,
      title,
      description: typeof stored.description === 'string' ? stored.description : title,
      payload: `inv_${invoice.id}`,
      currency: 'XTR' as const,
      amount: Number(invoice.providerAmount?.toFixed(0) ?? 0),
    };
  }

  /**
   * `pre_checkout_query`: the invoice is pending, unexpired, the payer's own,
   * and the amount is the one it was issued for. The bot must answer within
   * ten seconds, so this reads and never writes.
   */
  async precheckout(body: unknown): Promise<{ ok: true }> {
    const input = parse(precheckoutSchema, body);
    const invoice = await this.ownInvoice(input.invoicePayload, String(input.telegramId));
    const failure = this.unpayable(invoice);
    if (failure) throw conflict(failure);
    if (input.currency !== 'XTR' || !invoice.providerAmount?.equals(input.totalAmount))
      throw conflict('AMOUNT_MISMATCH');
    return { ok: true };
  }

  /**
   * `message.successful_payment`: Telegram has taken the stars. The event is
   * stored under `telegram_payment_charge_id` and applied; a redelivered update
   * finds the stored event and applies it again, which is a no-op once it has
   * been processed. A failure propagates so the bot leaves the update pending
   * and retries it rather than acknowledging a payment it did not record.
   */
  async successfulPayment(body: unknown) {
    const input = parse(successfulPaymentSchema, body);
    const invoiceId = PAYLOAD.exec(input.invoicePayload)?.[1];
    const invoice = invoiceId
      ? ((await this.infra.db.invoice.findFirst({
          where: { id: invoiceId, provider: 'stars' },
        })) as StarsInvoice | null)
      : null;
    const paidAmountMinorRub = invoice ? paidInRoubles(invoice, input.totalAmount) : undefined;
    const stored = await this.repository.insertEvent({
      provider: 'stars',
      externalId: input.telegramPaymentChargeId,
      ...(invoice ? { invoiceId: invoice.id } : {}),
      event: {
        eventId: input.telegramPaymentChargeId,
        providerInvoiceId: input.invoicePayload,
        type: 'paid',
        paidAmount: { amount: String(input.totalAmount), currency: input.currency },
        ...(paidAmountMinorRub === undefined ? {} : { paidAmountMinorRub }),
      },
      raw: {
        providerInvoiceId: input.invoicePayload,
        telegramId: String(input.telegramId),
        telegramPaymentChargeId: input.telegramPaymentChargeId,
        ...(input.providerPaymentChargeId
          ? { providerPaymentChargeId: input.providerPaymentChargeId }
          : {}),
        totalAmount: input.totalAmount,
        currency: input.currency,
        ...(paidAmountMinorRub === undefined
          ? {}
          : { paidAmountMinorRub: paidAmountMinorRub.toString() }),
      },
      headers: { source: 'bot' },
      signatureOk: true,
    });
    await this.repository.applyEvent(stored.id);
    const after = invoice
      ? await this.infra.db.invoice.findUnique({
          where: { id: invoice.id },
          select: { status: true },
        })
      : null;
    return {
      ok: true as const,
      duplicate: stored.duplicate,
      ...(invoice ? { invoiceId: invoice.id } : {}),
      ...(after ? { status: after.status } : {}),
    };
  }

  /** An invoice another user owns is reported exactly like one that does not exist. */
  private async ownInvoice(payload: string, actingTelegramId: string): Promise<StarsInvoice> {
    const invoiceId = PAYLOAD.exec(payload)?.[1];
    if (!invoiceId) throw conflict('INVOICE_NOT_FOUND');
    const [invoice, user] = await Promise.all([
      this.infra.db.invoice.findFirst({
        where: { id: invoiceId, provider: 'stars' },
      }) as Promise<StarsInvoice | null>,
      this.infra.db.user.findUnique({
        where: { telegramId: BigInt(actingTelegramId) },
        select: { id: true },
      }),
    ]);
    if (!invoice || invoice.provider !== 'stars' || !user || invoice.userId !== user.id)
      throw conflict('INVOICE_NOT_FOUND');
    return invoice;
  }

  private unpayable(invoice: StarsInvoice): string | null {
    if (invoice.status !== 'pending') return 'INVOICE_NOT_PENDING';
    if (invoice.expiresAt.getTime() <= Date.now()) return 'INVOICE_EXPIRED';
    return null;
  }
}

/**
 * The stars paid, in the shop's roubles: the full invoice when Telegram charged
 * what the invoice asked, otherwise the same share of it, so the section 11.4
 * underpayment rule applies to Stars as it does to every provider.
 */
function paidInRoubles(invoice: StarsInvoice, totalAmount: number): bigint | undefined {
  if (!invoice.providerAmount) return undefined;
  const invoiced = BigInt(invoice.providerAmount.toFixed(0));
  if (invoiced <= 0n) return undefined;
  const paid = BigInt(totalAmount);
  return paid >= invoiced ? invoice.amountMinor : (invoice.amountMinor * paid) / invoiced;
}
