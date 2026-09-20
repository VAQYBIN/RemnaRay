import { ForbiddenException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SECTION_9_9_METRICS } from '@remnaray/metrics';
import { afterEach, describe, expect, it } from 'vitest';

import { MetricsController } from './metrics.controller';

function requestFrom(address: string) {
  return { raw: { socket: { remoteAddress: address } } } as unknown as FastifyRequest;
}

function reply() {
  const sent: { type?: string; body?: unknown } = {};
  const fake = {
    type(value: string) {
      sent.type = value;
      return fake;
    },
    send(value: unknown) {
      sent.body = value;
      return fake;
    },
  };
  return { reply: fake as unknown as FastifyReply, sent };
}

describe('GET /metrics (sections 9.9, 19.7)', () => {
  afterEach(() => {
    delete process.env.RR_TRUSTED_INTERNAL_CIDR;
  });

  it('refuses an address outside the compose network', async () => {
    const controller = new MetricsController();

    // The proxy already denies this, and section 19.7 asks the API to check
    // again: a container that reached `api:3000` directly never met the proxy.
    await expect(controller.metrics(requestFrom('203.0.113.7'), reply().reply)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('serves every section 9.9 metric to the compose network', async () => {
    const controller = new MetricsController();
    const { reply: target, sent } = reply();

    await controller.metrics(requestFrom('172.28.1.4'), target);

    expect(sent.type).toMatch(/^text\/plain/u);
    for (const name of SECTION_9_9_METRICS) expect(String(sent.body)).toContain(`# TYPE ${name} `);
  });

  it('follows RR_TRUSTED_INTERNAL_CIDR when a deployment narrows it', async () => {
    process.env.RR_TRUSTED_INTERNAL_CIDR = '10.9.0.0/16';
    const controller = new MetricsController();

    await expect(controller.metrics(requestFrom('172.28.1.4'), reply().reply)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.metrics(requestFrom('10.9.0.5'), reply().reply)).resolves.toBeDefined();
  });
});
