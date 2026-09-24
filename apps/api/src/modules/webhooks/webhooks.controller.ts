import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { InternalTokenGuard } from '../auth/auth.guards';
import { WebhooksService } from './webhooks.service';

/** Section 9.8 jobs, called by the worker. */
@Controller('api/internal/v1/webhooks')
@UseGuards(InternalTokenGuard)
export class InternalWebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('dispatch')
  @HttpCode(200)
  dispatch(@Body() body: unknown) {
    return this.webhooks.dispatch(body);
  }

  @Post('deliver')
  @HttpCode(200)
  deliver(@Body() body: unknown) {
    return this.webhooks.deliver(body);
  }
}
