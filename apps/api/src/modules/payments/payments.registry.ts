import { Injectable } from '@nestjs/common';

import { PaymentError } from './payments.errors';
import type { PaymentProvider, ProviderCode } from './payments.types';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<ProviderCode, PaymentProvider>();

  register(provider: PaymentProvider): void {
    this.providers.set(provider.code, provider);
  }

  get(code: string): PaymentProvider {
    const provider = this.providers.get(code as ProviderCode);
    if (!provider) throw new PaymentError('PAYMENT_PROVIDER_NOT_FOUND');
    return provider;
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }
}
