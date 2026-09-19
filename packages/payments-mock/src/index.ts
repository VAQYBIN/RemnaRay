import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export type MockEvent = {
  eventId: string;
  providerInvoiceId: string;
  type: 'paid' | 'canceled' | 'pending';
  paidAmountMinorRub?: bigint;
};

export class MockPaymentProvider {
  readonly code = 'mock' as const;
  readonly capabilities = {
    receipts: false,
    webhooks: true,
    statusPolling: true,
    kind: 'redirect' as const,
    currencies: ['RUB'],
  };
  readonly configSchema = z.object({ secret: z.string().default('mock-secret') });
  private readonly events = new Map<string, MockEvent>();

  createInvoice(params: { invoiceId: string; amountMinor: bigint; expiresAt: Date }) {
    return Promise.resolve({
      providerInvoiceId: params.invoiceId,
      paymentUrl: `http://payments-mock.test/pay/${params.invoiceId}`,
      expiresAt: params.expiresAt,
      rawSafe: { providerInvoiceId: params.invoiceId },
    });
  }

  verifyWebhook(
    raw: Buffer,
    headers: Record<string, string>,
    _ip: string,
    config: Record<string, unknown>,
  ) {
    const secret = typeof config.secret === 'string' ? config.secret : 'mock-secret';
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const actual = headers['x-mock-signature'] ?? '';
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    return { ok: a.length === b.length && timingSafeEqual(a, b), reason: 'invalid mock signature' };
  }

  parseWebhook(raw: Buffer) {
    const value = JSON.parse(raw.toString('utf8')) as {
      eventId: string;
      providerInvoiceId: string;
      type: MockEvent['type'];
      paidAmountMinorRub?: string;
    };
    return {
      eventId: value.eventId,
      providerInvoiceId: value.providerInvoiceId,
      type: value.type,
      ...(value.paidAmountMinorRub ? { paidAmountMinorRub: BigInt(value.paidAmountMinorRub) } : {}),
    };
  }

  ackResponse() {
    return { status: 200, body: { ok: true }, contentType: 'application/json' };
  }

  fetchStatus(providerInvoiceId: string) {
    const event = this.events.get(providerInvoiceId);
    return Promise.resolve(event ? { ...event } : { providerInvoiceId, type: 'pending' as const });
  }

  healthcheck() {
    return Promise.resolve({ ok: true, latencyMs: 0 });
  }

  setEvent(event: MockEvent) {
    this.events.set(event.providerInvoiceId, event);
  }
}
