import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import { encryptSetting } from '../settings/settings.crypto';
import type { PaymentsRepository } from './payments.repository';
import { createPaymentProviderRegistry } from './payments.registry';
import { PaymentsService } from './payments.service';

function harness() {
  const db = {
    paymentProvider: {
      findUnique: vi.fn().mockResolvedValue({ code: 'stars', enabled: true, configEnc: null }),
    },
    invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice-1' }) },
    outboxJob: { create: vi.fn() },
  };
  const repository = {
    insertEvent: vi.fn().mockResolvedValue({ id: 'event-1', duplicate: false }),
    applyEvent: vi.fn(),
  };
  const service = new PaymentsService(
    { db } as unknown as Infrastructure,
    repository as unknown as PaymentsRepository,
    createPaymentProviderRegistry({}),
  );
  return { db, repository, service };
}

/** What anyone on the internet could POST at `/webhooks/stars`. */
const forgedStarsUpdate = Buffer.from(
  JSON.stringify({
    message: {
      successful_payment: {
        invoice_payload: 'invoice-1',
        total_amount: 1,
        currency: 'XTR',
        telegram_payment_charge_id: 'forged-charge',
      },
    },
  }),
);

describe('PaymentsService.receiveWebhook (sections 9.7, 11.3.6)', () => {
  it('refuses an HTTP webhook for Telegram Stars before storing or applying anything', async () => {
    const { db, repository, service } = harness();

    await expect(
      service.receiveWebhook('stars', forgedStarsUpdate, {}, '203.0.113.7'),
    ).rejects.toMatchObject({ name: 'PaymentError', code: 'WEBHOOK_NOT_SUPPORTED' });

    expect(repository.insertEvent).not.toHaveBeenCalled();
    expect(repository.applyEvent).not.toHaveBeenCalled();
    expect(db.outboxJob.create).not.toHaveBeenCalled();
  });

  it('refuses the other providers without an HTTP webhook the same way', async () => {
    for (const code of ['platega', 'balance']) {
      const { repository, service } = harness();
      await expect(
        service.receiveWebhook(code, Buffer.from('{}'), {}, '203.0.113.7'),
      ).rejects.toMatchObject({ code: 'WEBHOOK_NOT_SUPPORTED' });
      expect(repository.insertEvent).not.toHaveBeenCalled();
    }
  });
});

describe('PaymentsService provider configuration', () => {
  const appKey = randomBytes(32).toString('base64');
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the configuration the console and the setup wizard store', async () => {
    vi.stubEnv('RR_APP_KEY', appKey);
    vi.stubEnv('RR_TELEGRAM_API_URL', 'http://telegram.test');
    const requests: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      requests.push(url);
      return Promise.resolve(Response.json({ ok: true, result: 'https://t.me/$link' }));
    });
    const db = {
      paymentProvider: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'stars',
          enabled: true,
          // Exactly what ProvidersService.update and SetupService write.
          configEnc: encryptSetting({ starsPerRub: 0.75 }, appKey).enc,
        }),
      },
      user: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', telegramId: 42n, email: null, language: 'ru' }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee' }]),
    };
    const repository = {
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      createInvoice: vi
        .fn()
        .mockImplementation((input: Record<string, unknown>) =>
          Promise.resolve({ ...input, status: 'pending' }),
        ),
      findInvoice: vi.fn().mockResolvedValue({ id: 'found' }),
    };
    const service = new PaymentsService(
      { db } as unknown as Infrastructure,
      repository as unknown as PaymentsRepository,
      createPaymentProviderRegistry({}),
      {
        get: (key: string) => Promise.resolve(key === 'bot.token' ? '123:bot' : undefined),
      } as never,
    );

    await service.createInvoice({
      userId: 'user-1',
      kind: 'topup',
      provider: 'stars',
      amountMinor: 10000n,
      idempotencyKey: 'key-1',
    });

    expect(requests).toEqual(['http://telegram.test/bot123:bot/createInvoiceLink']);
    expect(repository.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',
        providerInvoiceId: 'inv_0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee',
        providerAmount: '75',
        providerCurrency: 'XTR',
        paymentUrl: 'https://t.me/$link',
      }),
    );
    // Section 11.4: Stars invoices live `invoice.ttl_minutes_crypto`, 60 by default.
    const [created] = repository.createInvoice.mock.calls[0] as [{ expiresAt: Date }];
    const minutes = (created.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });
});

describe('PaymentsService.recheck (section 7.3 status polling)', () => {
  const appKey = randomBytes(32).toString('base64');
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('stores the amount a poll reports in roubles, so EX-12 sees an underpayment', async () => {
    vi.stubEnv('RR_APP_KEY', appKey);
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        Response.json({
          ok: true,
          result: { items: [{ status: 'paid', amount: '150.00', fiat: 'RUB' }] },
        }),
      ),
    );
    const db = {
      paymentProvider: {
        findUnique: vi.fn().mockResolvedValue({
          code: 'cryptobot',
          enabled: true,
          configEnc: encryptSetting({ token: 't', baseUrl: 'http://cryptobot.test/api' }, appKey)
            .enc,
        }),
      },
    };
    const repository = {
      findInvoice: vi
        .fn()
        .mockResolvedValue({ id: 'invoice-1', provider: 'cryptobot', providerInvoiceId: '77' }),
      insertEvent: vi.fn().mockResolvedValue({ id: 'event-1', duplicate: false }),
      applyEvent: vi.fn(),
    };
    const service = new PaymentsService(
      { db } as unknown as Infrastructure,
      repository as unknown as PaymentsRepository,
      createPaymentProviderRegistry({}),
    );

    await service.recheck('invoice-1');

    expect(repository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: 'poll:77:paid',
        raw: expect.objectContaining({ paidAmountMinorRub: '15000' }) as object,
      }),
    );
    expect(repository.applyEvent).toHaveBeenCalledWith('event-1');
  });
});
