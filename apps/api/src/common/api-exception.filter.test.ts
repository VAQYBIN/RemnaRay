import { BadRequestException, ForbiddenException, HttpStatus, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from '../modules/me/me.errors';
import { ApiExceptionFilter } from './api-exception.filter';

function answer(exception: unknown, headers: Record<string, string> = {}) {
  const sent: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const reply = {
    status(code: number) {
      sent.status = code;
      return reply;
    },
    header(name: string, value: string) {
      sent.headers[name] = value;
      return reply;
    },
    send(body: unknown) {
      sent.body = body;
      return reply;
    },
  };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ id: 'req-9', headers }),
      getResponse: () => reply,
    }),
  };
  new ApiExceptionFilter().catch(exception, host as never);
  return sent as { status: number; body: { error: Record<string, unknown> }; headers: object };
}

describe('ApiExceptionFilter (section 9.3)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('answers a Zod failure with 400 VALIDATION_ERROR and the path of each field', () => {
    const failure = z
      .object({ panel: z.object({ url: z.url() }) })
      .safeParse({ panel: { url: 'panel.example' } });
    if (failure.success) throw new Error('expected a failure');

    const sent = answer(failure.error, { 'x-request-id': 'proxy-1' });

    expect(sent.status).toBe(400);
    expect(sent.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'errors.validation_error',
      details: [{ path: 'panel.url', message: expect.any(String) as string }],
      requestId: 'proxy-1',
    });
    expect(sent.body.error).not.toHaveProperty('incidentId');
  });

  it('keeps an envelope a handler built and adds the request id', () => {
    const sent = answer(new ApiError('INSUFFICIENT_FUNDS', HttpStatus.CONFLICT));

    expect(sent.status).toBe(409);
    expect(sent.body.error).toMatchObject({ code: 'INSUFFICIENT_FUNDS', requestId: 'req-9' });
  });

  it('turns a Nest exception into the envelope', () => {
    expect(answer(new ForbiddenException('FORBIDDEN')).body.error).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(
      answer(new BadRequestException({ code: 'VALIDATION_ERROR', details: [{ path: ['x'] }] })),
    ).toMatchObject({
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', details: [{ path: ['x'] }] } },
    });
    expect(answer(new BadRequestException('Unexpected token')).body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('logs an unexpected error under an incident id it answers, without its message', () => {
    const log = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const sent = answer(new Error('connect ECONNREFUSED 10.0.0.5:5432'));

    expect(sent.status).toBe(500);
    expect(sent.body.error).toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'req-9' });
    const incidentId = sent.body.error.incidentId as string;
    expect(incidentId).toMatch(/^[0-9A-Z]{26}$/u);
    expect(JSON.stringify(sent.body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(log.mock.calls)).toContain(incidentId);
  });

  it('ignores a request id that is not a plain token', () => {
    const sent = answer(new ForbiddenException('FORBIDDEN'), { 'x-request-id': 'a\nb<script>' });
    expect(sent.body.error.requestId).toBe('req-9');
  });
});
