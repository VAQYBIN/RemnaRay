import { describe, expect, it } from 'vitest';

import { MockPaymentProvider } from './index.js';

describe('MockPaymentProvider.parseWebhook', () => {
  const provider = new MockPaymentProvider();

  it('reads an event that names an invoice and a type', () => {
    const parsed = provider.parseWebhook(
      Buffer.from(
        JSON.stringify({
          eventId: 'evt-1',
          providerInvoiceId: 'inv-1',
          type: 'paid',
          paidAmountMinorRub: '29900',
        }),
      ),
    );

    expect(parsed).toEqual({
      eventId: 'evt-1',
      providerInvoiceId: 'inv-1',
      type: 'paid',
      paidAmountMinorRub: 29_900n,
    });
  });

  it('refuses a payload that names no event', () => {
    // `payment_events.type` is not nullable: a parser that returned an
    // untyped event here would turn a POST of `{}` into a 500 (section 9.7).
    expect(provider.parseWebhook(Buffer.from('{}'))).toBeNull();
    expect(provider.parseWebhook(Buffer.from(JSON.stringify({ type: 'paid' })))).toBeNull();
    expect(
      provider.parseWebhook(Buffer.from(JSON.stringify({ providerInvoiceId: 'inv-1' }))),
    ).toBeNull();
  });
});
