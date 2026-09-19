import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/health')
export class HealthController {
  @Get()
  liveness() {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  readiness() {
    return {
      status: 'ok',
      checks: {
        db: { status: 'not-configured' },
        valkey: { status: 'not-configured' },
        panel: { status: 'not-configured' },
        migrations: { status: 'not-configured' },
        setup: { status: 'not-configured' },
      },
    };
  }
}
