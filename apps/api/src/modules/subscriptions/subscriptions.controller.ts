import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { InternalTokenGuard } from '../auth/auth.guards';
import { SubscriptionsService } from './subscriptions.service';

@Controller('api/internal/v1/subscriptions')
@UseGuards(InternalTokenGuard)
export class InternalSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post('expire')
  @HttpCode(200)
  expire() {
    return this.subscriptions.expire();
  }
}
