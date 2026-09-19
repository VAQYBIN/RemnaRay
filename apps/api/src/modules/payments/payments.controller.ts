import { Body, Controller, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { PaymentsService } from './payments.service';
import { AuthGuard, InternalTokenGuard, type AuthenticatedRequest } from '../auth/auth.guards';

@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':provider')
  async webhook(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<FastifyRequest>,
    @Headers() headers: Record<string, string>,
    @Res() response: FastifyReply,
  ) {
    try {
      const result = await this.payments.receiveWebhook(
        provider,
        request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
        headers,
        request.ip,
      );
      return await response.status(result.status).type(result.contentType).send(result.body);
    } catch (error) {
      if (error instanceof Error && error.name === 'PaymentError')
        return response.status(400).send({ code: error.message });
      throw error;
    }
  }
}

@Controller('api/v1/me/invoices')
@UseGuards(AuthGuard)
export class PaymentsUserController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  create(
    @Body()
    body: {
      userId?: string;
      kind: 'purchase' | 'topup' | 'plan_change';
      planId?: string;
      provider: string;
    },
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payments.createInvoice({
      ...body,
      userId: request.user?.id ?? body.userId ?? '',
      idempotencyKey: key ?? '',
    });
  }

  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.payments.recheck(id);
  }
}

@Controller('api/internal/v1/payments')
@UseGuards(InternalTokenGuard)
export class PaymentsInternalController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('events/:id/apply')
  apply(@Param('id') id: string) {
    return this.payments.applyEvent(id);
  }

  @Post('expire')
  expire() {
    return this.payments.expire();
  }

  @Post('poll-pending')
  poll() {
    return this.payments.pollPending();
  }
}
