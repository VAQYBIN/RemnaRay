import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { InternalTokenGuard } from '../auth/auth.guards';
import { NotifyService } from './notify.service';

@Controller('api/internal/v1/notify')
@UseGuards(InternalTokenGuard)
export class InternalNotifyController {
  constructor(private readonly notify: NotifyService) {}

  @Post('send')
  @HttpCode(200)
  send(@Body() body: unknown) {
    return this.notify.send(body);
  }

  @Post('scan-expiring')
  @HttpCode(200)
  scanExpiring() {
    return this.notify.scanExpiring();
  }

  @Post('alert')
  @HttpCode(200)
  alert(@Body() body: unknown) {
    return this.notify.alert(body);
  }
}
