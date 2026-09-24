import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';
import { z } from 'zod';

import { RemnawaveService } from './remnawave.service';

const userSchema = z.object({ userId: z.uuid() });
const syncUserSchema = z.object({ userId: z.uuid(), reason: z.string().max(64).default('queue') });

@Controller('api/internal/v1/remnawave')
export class RemnawaveInternalController {
  constructor(private readonly panel: RemnawaveService) {}

  /** Queue consumer for `panel.sync-user` (section 7.3). */
  @Post('sync-user')
  @HttpCode(200)
  async syncUser(@Body() body: unknown) {
    const input = syncUserSchema.parse(body);
    try {
      const result = await this.panel.syncUser(input.userId, input.reason);
      return { synced: result !== null };
    } catch (error) {
      throw new BadRequestException(`PANEL_UNAVAILABLE: ${String(error)}`);
    }
  }

  /** Queue consumer for `panel.reset-traffic` (FR-141). */
  @Post('reset-traffic')
  @HttpCode(200)
  async resetTraffic(@Body() body: unknown) {
    const { userId } = userSchema.parse(body);
    try {
      return await this.panel.resetTraffic(userId);
    } catch (error) {
      throw new BadRequestException(`PANEL_UNAVAILABLE: ${String(error)}`);
    }
  }

  /** Queue consumer for `panel.delete-user` (section 19.5). */
  @Post('delete-user')
  @HttpCode(200)
  async deleteUser(@Body() body: unknown) {
    const { userId } = userSchema.parse(body);
    try {
      return await this.panel.deleteUser(userId);
    } catch (error) {
      throw new BadRequestException(`PANEL_UNAVAILABLE: ${String(error)}`);
    }
  }

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
