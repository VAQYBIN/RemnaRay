import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';

import { RemnawaveService } from './remnawave.service';

@Controller('api/internal/v1/remnawave')
export class RemnawaveInternalController {
  constructor(private readonly panel: RemnawaveService) {}

  @Get('health')
  health() {
    return this.panel.health();
  }

  @Post('reconcile')
  @HttpCode(200)
  reconcile() {
    return this.panel.reconcile();
  }
}

@Controller('webhooks/remnawave')
export class RemnawaveWebhookController {
  constructor(private readonly panel: RemnawaveService) {}

  @Post()
  @HttpCode(200)
  async webhook(
    @Body() body: unknown,
    @Headers('x-remnawave-signature') signature?: string,
    @Headers('x-remnawave-timestamp') timestamp?: string,
  ) {
    if (!(await this.panel.verifyWebhook(body, signature, timestamp)))
      return { ok: false, error: 'WEBHOOK_INVALID_SIGNATURE' };
    await this.panel.handleWebhook(body);
    return { ok: true };
  }
}
