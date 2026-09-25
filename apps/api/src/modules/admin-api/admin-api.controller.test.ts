import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { IdempotencyInterceptor } from '../../common/idempotency.interceptor';
import { AdminPaymentsController, AdminUsersController } from './admin-api.controller';

function interceptors(handler: unknown): unknown[] {
  return (
    (Reflect.getMetadata(INTERCEPTORS_METADATA, handler as object) as unknown[] | undefined) ?? []
  );
}

describe('section 9.1 Idempotency-Key on the console', () => {
  it('covers every console POST that creates money or subscriptions', () => {
    for (const [controller, name] of [
      [AdminUsersController, 'extend'],
      [AdminUsersController, 'setPlan'],
      [AdminUsersController, 'balance'],
      [AdminPaymentsController, 'refund'],
      [AdminPaymentsController, 'bulkExtend'],
    ] as const)
      expect(interceptors(Reflect.get(controller.prototype, name)), name).toContain(
        IdempotencyInterceptor,
      );
  });
});
