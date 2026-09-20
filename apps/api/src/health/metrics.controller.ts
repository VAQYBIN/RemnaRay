import { Controller, ForbiddenException, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { metricsContentType, metricsText } from '@remnaray/metrics';

import { trustedInternal } from '../modules/auth/auth.guards';

/**
 * Section 9.9: Prometheus text, from the internal network only. The proxy
 * already denies everything outside the compose CIDR (section 19.7), and this
 * is the second check that section asks for — a request that reached `api:3000`
 * directly, from a container the proxy never saw, is refused here.
 */
@Controller('metrics')
export class MetricsController {
  @Get()
  async metrics(@Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    if (!trustedInternal(request.raw.socket.remoteAddress ?? ''))
      throw new ForbiddenException('FORBIDDEN');
    return reply.type(metricsContentType).send(await metricsText());
  }
}
