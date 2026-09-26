import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { ulid } from '../modules/webhooks/outgoing';

type Envelope = {
  code: string;
  message: string;
  messageKey: string;
  details?: unknown;
  incidentId?: string;
};

/** Codes of section 9.3 for an exception that names none. */
const STATUS_CODES: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

/**
 * Section 9.3: every error answers `{ error: { code, message, messageKey,
 * details?, incidentId?, requestId } }`. A Zod failure is 400
 * `VALIDATION_ERROR` with `details[]` of `{ path, message }` (section 8,
 * "Валидация"); a 5xx carries an `incidentId` that is also logged, never the
 * error's own message; `requestId` is the proxy's `X-Request-Id`, or
 * Fastify's own id without one.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const requestId = requestIdOf(request);
    const { status, error } = envelope(exception);
    if (status >= 500) {
      error.incidentId = ulid();
      this.logger.error(
        {
          incidentId: error.incidentId,
          requestId,
          err: exception instanceof Error ? exception : String(exception),
        },
        'Unhandled API error',
      );
    }
    void reply
      .status(status)
      .header('x-request-id', requestId)
      .send({ error: { ...error, requestId } });
  }
}

function envelope(exception: unknown): { status: number; error: Envelope } {
  if (exception instanceof ZodError)
    return {
      status: HttpStatus.BAD_REQUEST,
      error: build('VALIDATION_ERROR', 'Validation failed', {
        details: exception.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      }),
    };
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const inner = record(record(body)?.error) ?? record(body);
    const named = typeof inner?.code === 'string' ? inner.code : undefined;
    const message =
      typeof inner?.message === 'string'
        ? inner.message
        : typeof body === 'string'
          ? body
          : exception.message;
    const code =
      named ?? (/^[A-Z][A-Z0-9_]*$/u.test(message) ? message : undefined) ?? fallback(status);
    return {
      status,
      error: build(code, status >= 500 ? code : message, {
        ...(typeof inner?.messageKey === 'string' ? { messageKey: inner.messageKey } : {}),
        ...(inner && 'details' in inner ? { details: inner.details } : {}),
      }),
    };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    error: build('INTERNAL_ERROR', 'Internal error'),
  };
}

function build(
  code: string,
  message: string,
  extra: { messageKey?: string; details?: unknown } = {},
): Envelope {
  return {
    code,
    message,
    messageKey: extra.messageKey ?? `errors.${code.toLowerCase()}`,
    ...(extra.details === undefined ? {} : { details: extra.details }),
  };
}

function fallback(status: number): string {
  return STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${String(status)}`);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requestIdOf(request: FastifyRequest): string {
  const header = request.headers['x-request-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && /^[A-Za-z0-9._-]{1,128}$/u.test(value) ? value : request.id;
}
