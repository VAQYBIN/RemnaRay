import { Injectable } from '@nestjs/common';
import { MockPaymentProvider } from '@remnaray/payments-mock';

import {
  BalanceProvider,
  CryptoBotProvider,
  LavaProvider,
  PlategaProvider,
  RobokassaProvider,
  StarsProvider,
  YooKassaProvider,
} from './builtin-providers';
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

  has(code: string): boolean {
    return this.providers.has(code as ProviderCode);
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }
}

/**
 * Section 22.4: the `mock` provider exists only with `RR_PAYMENTS_MOCK=true`
 * and is absent from a production registry. Its webhook secret has a public
 * default, so registering it anywhere else lets a customer mark their own
 * invoice paid.
 */
export function createPaymentProviderRegistry(
  env: Record<string, string | undefined> = process.env,
): PaymentProviderRegistry {
  const registry = new PaymentProviderRegistry();
  if (env.RR_PAYMENTS_MOCK === 'true') registry.register(new MockPaymentProvider());
  for (const provider of [
    new YooKassaProvider(),
    new RobokassaProvider(),
    new LavaProvider(),
    new PlategaProvider(),
    new CryptoBotProvider(),
    new StarsProvider(),
    new BalanceProvider(),
  ])
    registry.register(provider);
  return registry;
}
