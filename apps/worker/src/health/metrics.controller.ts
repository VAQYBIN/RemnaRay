import { Controller, Get, Header } from '@nestjs/common';
import { metricsContentType, metricsText } from '@remnaray/metrics';

/**
 * Section 20.2: the worker exposes its own `/metrics` on `:3003`. The port is
 * `expose`, never published, so the compose network is the only client.
 */
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('content-type', metricsContentType)
  metrics(): Promise<string> {
    return metricsText();
  }
}
