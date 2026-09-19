import { describe, expect, it } from 'vitest';

import { SubscriptionError } from './subscriptions.errors';
import type { SubscriptionConfig, SubscriptionsRepositoryPort } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

class MemorySubscriptions implements SubscriptionsRepositoryPort {
  config?: SubscriptionConfig;
  currentValue = null;
  trial(_userId: string, config: SubscriptionConfig) {
    this.config = config;
    return Promise.resolve({
      id: 'sub',
      userId: 'user',
      planId: null,
      source: 'trial',
      status: 'active',
      startsAt: '',
      expiresAt: '',
      trafficLimitBytes: '0',
      deviceLimit: 1,
      squads: [],
      trafficResetStrategy: 'NO_RESET',
    });
  }
  current() {
    return Promise.resolve(this.currentValue);
  }
  activate() {
    return Promise.reject(new SubscriptionError('PLAN_UNAVAILABLE'));
  }
  quotePlanChange() {
    return Promise.reject(new Error('unused'));
  }
  applyPlanChange() {
    return Promise.reject(new Error('unused'));
  }
  expire() {
    return Promise.resolve(0);
  }
}

describe('SubscriptionsService', () => {
  it('reads trial settings as a single domain configuration', async () => {
    const repository = new MemorySubscriptions();
    const values: Record<string, unknown> = {
      'trial.enabled': true,
      'trial.days': 3,
      'trial.traffic_gb': 10,
      'trial.device_limit': 1,
      'trial.squads': [],
      'subscription.grace_hours': 0,
    };
    const settings = { get: (key: string) => Promise.resolve(values[key]) } as never;
    await new SubscriptionsService(repository, settings).trial('user');
    expect(repository.config).toEqual({
      trialEnabled: true,
      trialDays: 3,
      trialTrafficGb: 10,
      trialDeviceLimit: 1,
      trialSquads: [],
      graceHours: 0,
    });
  });
});
