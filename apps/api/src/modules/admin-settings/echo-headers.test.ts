import { NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { InternalEchoController } from './proxy.controller';

/** What a proxy of either profile sends upstream for `POST /echo-headers`. */
function requestFrom(headers: Record<string, string | string[]>) {
  return {
    headers,
    ip: '203.0.113.7',
    protocol: 'https',
  } as unknown as FastifyRequest;
}

const proxied = {
  host: 'rr.test',
  'x-forwarded-for': '172.28.0.9',
  'x-forwarded-proto': 'https',
  'x-forwarded-host': 'rr.test',
  'x-real-ip': '172.28.0.9',
  'x-request-id': 'e4f1c0d2',
};

describe('InternalEchoController (sections 21.5, 22.7)', () => {
  afterEach(() => {
    delete process.env.RR_ECHO_HEADERS;
  });

  it('does not exist unless the smoke stand turned it on', () => {
    const controller = new InternalEchoController();
    expect(() => controller.echo(requestFrom(proxied))).toThrow(NotFoundException);

    process.env.RR_ECHO_HEADERS = 'false';
    expect(() => controller.echo(requestFrom(proxied))).toThrow(NotFoundException);
  });

  it('reports what the proxy sent, so both profiles can be compared', () => {
    process.env.RR_ECHO_HEADERS = 'true';

    expect(new InternalEchoController().echo(requestFrom(proxied))).toEqual({
      host: 'rr.test',
      clientIp: '203.0.113.7',
      protocol: 'https',
      forwardedFor: '172.28.0.9',
      forwardedProto: 'https',
      forwardedHost: 'rr.test',
      realIp: '172.28.0.9',
      requestId: 'e4f1c0d2',
    });
  });

  it('reports a missing header as null rather than omitting it', () => {
    process.env.RR_ECHO_HEADERS = 'true';

    // A stand whose proxy forgot a header must fail the comparison with a
    // visible `null`, not with a key that quietly disappeared.
    const echoed = new InternalEchoController().echo(requestFrom({ host: 'rr.test' }));
    expect(echoed.forwardedProto).toBeNull();
    expect(echoed.realIp).toBeNull();
    expect(echoed.requestId).toBeNull();
  });

  it('reads the first value when a header arrives more than once', () => {
    process.env.RR_ECHO_HEADERS = 'true';

    const echoed = new InternalEchoController().echo(
      requestFrom({ ...proxied, 'x-forwarded-proto': ['https', 'http'] }),
    );
    expect(echoed.forwardedProto).toBe('https');
  });
});
