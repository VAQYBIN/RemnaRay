import { describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
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
