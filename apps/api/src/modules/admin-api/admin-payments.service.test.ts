import { describe, expect, it, vi } from 'vitest';

import type { Infrastructure } from '../../infra/infra.module';
import { PaymentError } from '../payments/payments.errors';
import type { PaymentsService } from '../payments/payments.service';
import type { SettingsService } from '../settings/settings.service';
import { AdminPaymentsService } from './admin-payments.service';

function service(failure: PaymentError) {
  const db = {
    transaction: {
      findUnique: vi.fn().mockResolvedValue({ id: 'tx-1', refundedMinor: 10000n, currency: 'RUB' }),
    },
  };
  const payments = { refund: vi.fn().mockRejectedValue(failure) };
  return new AdminPaymentsService(
    { db } as unknown as Infrastructure,
    payments as unknown as PaymentsService,
    { get: vi.fn() } as unknown as SettingsService,
  );
}

const admin = { id: 'admin-1', role: 'admin' as const };

describe('AdminPaymentsService.refund (FR-066, AC-066)', () => {
  it.each([['REFUND_EXCEEDS_REMAINING' as const], ['REFUND_NOT_PURCHASE' as const]])(
    'answers %s with 409 CONFLICT instead of a 500',
    async (code) => {
      await expect(
        service(new PaymentError(code)).refund(
          'tx-1',
          { amountMinor: 20000, reason: 'customer request' },
          admin,
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { error: { code: 'CONFLICT', details: { reason: code } } },
      });
    },
  );
});
