import { Prisma } from '@remnaray/db';
import { describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import type { PaymentsRepository } from './payments.repository';
import { StarsService } from './stars.service';

const INVOICE_ID = '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee';
const PAYLOAD = `inv_${INVOICE_ID}`;

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE_ID,
    userId: 'user-1',
    provider: 'stars',
    status: 'pending',
    amountMinor: 29900n,
    providerAmount: new Prisma.Decimal(225),
    providerInvoiceId: PAYLOAD,
    paymentUrl: 'https://t.me/$abc',
    providerPayload: { title: 'Premium', description: 'Premium 30 days' },
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function harness(row: Record<string, unknown> | null = invoice()) {
  const db = {
    invoice: {
      findFirst: vi.fn().mockResolvedValue(row),
      findUnique: vi.fn().mockResolvedValue(row ? { ...row, status: 'paid' } : null),
    },
    user: {
      findUnique: vi
        .fn()
        .mockImplementation(({ where }: { where: { telegramId: bigint } }) =>
          Promise.resolve(where.telegramId === 42n ? { id: 'user-1' } : { id: 'user-2' }),
        ),
    },
  };
  const repository = {
    insertEvent: vi.fn().mockResolvedValue({ id: 'event-1', duplicate: false }),
    applyEvent: vi.fn().mockResolvedValue(undefined),
  };
  const service = new StarsService(
    { db } as unknown as Infrastructure,
    repository as unknown as PaymentsRepository,
  );
  return { db, repository, service };
}

const precheckout = (overrides: Record<string, unknown> = {}) => ({
  telegramId: 42,
  invoicePayload: PAYLOAD,
  totalAmount: 225,
  currency: 'XTR',
  ...overrides,
});

describe('StarsService.precheckout (section 11.3.6)', () => {
  it('approves a pending, unexpired invoice of the payer at the invoiced amount', async () => {
    await expect(harness().service.precheckout(precheckout())).resolves.toEqual({ ok: true });
  });

  it.each([
    ['another user', precheckout({ telegramId: 7 }), invoice(), 'INVOICE_NOT_FOUND'],
    [
      'an unknown payload',
      precheckout({ invoicePayload: 'inv_x' }),
      invoice(),
      'INVOICE_NOT_FOUND',
    ],
    ['a non-Stars invoice', precheckout(), invoice({ provider: 'yookassa' }), 'INVOICE_NOT_FOUND'],
    ['a paid invoice', precheckout(), invoice({ status: 'paid' }), 'INVOICE_NOT_PENDING'],
    [
      'an expired invoice',
      precheckout(),
      invoice({ expiresAt: new Date(Date.now() - 1) }),
      'INVOICE_EXPIRED',
    ],
    ['a different amount', precheckout({ totalAmount: 1 }), invoice(), 'AMOUNT_MISMATCH'],
    ['a different currency', precheckout({ currency: 'USD' }), invoice(), 'AMOUNT_MISMATCH'],
  ])('refuses %s with 409', async (_name, input, row, code) => {
    const { service } = harness(row);
    await expect(service.precheckout(input)).rejects.toMatchObject({
      status: 409,
      code,
    });
  });
});

const payment = (overrides: Record<string, unknown> = {}) => ({
  telegramId: 42,
  telegramPaymentChargeId: 'charge-1',
  providerPaymentChargeId: 'provider-charge-1',
  invoicePayload: PAYLOAD,
  totalAmount: 225,
  currency: 'XTR',
  ...overrides,
});

describe('StarsService.successfulPayment (section 11.3.6)', () => {
  it('stores the payment keyed by telegram_payment_charge_id and applies it', async () => {
    const { repository, service } = harness();

    await expect(service.successfulPayment(payment())).resolves.toMatchObject({
      ok: true,
      invoiceId: INVOICE_ID,
      status: 'paid',
    });

    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'stars',
        externalId: 'charge-1',
        invoiceId: INVOICE_ID,
        signatureOk: true,
        event: expect.objectContaining({ type: 'paid', providerInvoiceId: PAYLOAD }) as object,
        raw: expect.objectContaining({ paidAmountMinorRub: '29900' }) as object,
      }),
    );
    expect(repository.applyEvent).toHaveBeenCalledWith('event-1');
  });

  it('re-applies a redelivered payment instead of dropping it', async () => {
    const { repository, service } = harness();
    repository.insertEvent.mockResolvedValue({ id: 'event-1', duplicate: true });

    await service.successfulPayment(payment());

    expect(repository.applyEvent).toHaveBeenCalledWith('event-1');
  });

  it('scales a short payment to roubles so the underpayment rule applies', async () => {
    const { repository, service } = harness();

    await service.successfulPayment(payment({ totalAmount: 100 }));

    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        raw: expect.objectContaining({ paidAmountMinorRub: '13288' }) as object,
      }),
    );
  });

  it('keeps a payment for an unknown invoice as evidence without an invoice', async () => {
    const { repository, service } = harness(null);

    await service.successfulPayment(payment());

    const [call] = repository.insertEvent.mock.calls[0] as [Record<string, unknown>];
    expect(call.invoiceId).toBeUndefined();
    expect(repository.applyEvent).toHaveBeenCalledWith('event-1');
  });

  it('propagates a failed apply so the bot redelivers the update', async () => {
    const { repository, service } = harness();
    repository.applyEvent.mockRejectedValue(new Error('database unavailable'));

    await expect(service.successfulPayment(payment())).rejects.toThrow('database unavailable');
  });

  it('refuses a malformed body', async () => {
    const { repository, service } = harness();
    await expect(
      service.successfulPayment(payment({ telegramPaymentChargeId: '' })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(service.successfulPayment(payment({ currency: 'RUB' }))).rejects.toMatchObject({
      status: 400,
    });
    expect(repository.insertEvent).not.toHaveBeenCalled();
  });
});

describe('StarsService.invoiceForBot (section 11.3.6 create-link)', () => {
  it('returns what sendInvoice needs for the payer’s pending invoice', async () => {
    await expect(harness().service.invoiceForBot('42', { invoiceId: INVOICE_ID })).resolves.toEqual(
      {
        invoiceId: INVOICE_ID,
        link: 'https://t.me/$abc',
        title: 'Premium',
        description: 'Premium 30 days',
        payload: PAYLOAD,
        currency: 'XTR',
        amount: 225,
      },
    );
  });

  it('refuses another user’s or an expired invoice', async () => {
    await expect(
      harness().service.invoiceForBot('7', { invoiceId: INVOICE_ID }),
    ).rejects.toMatchObject({ code: 'INVOICE_NOT_FOUND' });
    await expect(
      harness(invoice({ expiresAt: new Date(Date.now() - 1) })).service.invoiceForBot('42', {
        invoiceId: INVOICE_ID,
      }),
    ).rejects.toMatchObject({ code: 'INVOICE_EXPIRED' });
  });
});
