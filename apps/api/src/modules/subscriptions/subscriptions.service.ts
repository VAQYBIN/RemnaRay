import { Injectable } from '@nestjs/common';

import { SettingsService } from '../settings/settings.service';
import { planIdSchema } from './subscriptions.schemas';
import type { SubscriptionConfig, SubscriptionsRepositoryPort } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly repository: SubscriptionsRepositoryPort,
    private readonly settings: SettingsService,
  ) {}

  async trial(userId: string) {
    const config: SubscriptionConfig = {
      trialEnabled: Boolean(await this.settings.get('trial.enabled')),
      trialDays: Number(await this.settings.get('trial.days')),
      trialTrafficGb: Number(await this.settings.get('trial.traffic_gb')),
      trialDeviceLimit: Number(await this.settings.get('trial.device_limit')),
      trialSquads: (await this.settings.get('trial.squads')) as string[],
      graceHours: Number(await this.settings.get('subscription.grace_hours')),
    };
    return this.repository.trial(userId, config);
  }

  current(userId: string) {
    return this.repository.current(userId);
  }

  async activate(userId: string, body: unknown) {
    const { planId } = planIdSchema.parse(body);
    return this.repository.activate(userId, planId, 'purchase');
  }

  async quoteChange(userId: string, body: unknown) {
    const { planId } = planIdSchema.parse(body);
    return this.repository.quotePlanChange(userId, planId);
  }

  async applyChange(userId: string, body: unknown) {
    const { planId } = planIdSchema.parse(body);
    return this.repository.applyPlanChange(userId, planId);
  }

  async expire() {
    return this.repository.expire(
      new Date(),
      Number(await this.settings.get('subscription.grace_hours')),
    );
  }
}
