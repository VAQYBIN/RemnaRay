import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { InternalTokenGuard } from '../auth/auth.guards';
import { SubscriptionsService } from './subscriptions.service';

type UserRequest = FastifyRequest & { user?: { id: string } };

@Controller('api/v1/me')
export class UserSubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('subscription')
  current(@Req() request: UserRequest) {
    return this.subscriptions.current(request.user?.id ?? '');
  }

  @Post('trial')
  @HttpCode(200)
  trial(@Req() request: UserRequest) {
    return this.subscriptions.trial(request.user?.id ?? '');
  }

  @Post('subscription/activate')
  @HttpCode(200)
  activate(@Req() request: UserRequest, @Body() body: unknown) {
    return this.subscriptions.activate(request.user?.id ?? '', body);
  }

  @Post('subscription/change/quote')
  @HttpCode(200)
  quote(@Req() request: UserRequest, @Body() body: unknown) {
    return this.subscriptions.quoteChange(request.user?.id ?? '', body);
  }

  @Post('subscription/change/apply')
  @HttpCode(200)
  apply(@Req() request: UserRequest, @Body() body: unknown) {
    return this.subscriptions.applyChange(request.user?.id ?? '', body);
  }
}

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
