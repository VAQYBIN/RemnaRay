import { createHash } from 'node:crypto';

import {
  HttpStatus,
  Injectable,
  SetMetadata,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply } from 'fastify';
import { catchError, from, mergeMap, of, type Observable } from 'rxjs';

import { Infrastructure } from '../infra/infra.module';
import type { AuthenticatedRequest } from '../modules/auth/auth.guards';
import { ApiError } from '../modules/me/me.errors';

/** Section 9.1: kept 24 h. */
const TTL_SECONDS = 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REQUIRED = 'rr:idempotency-required';

/** Section 9.4 marks the key required on some routes (`POST /me/invoices`). */
export const IdempotencyRequired = () => SetMetadata(REQUIRED, true);

type Entry =
  { state: 'pending'; fingerprint: string } | { state: 'done'; fingerprint: string; body: unknown };

/**
 * Sections 9.1–9.3: a POST that creates money, an invoice or a subscription
 * takes `Idempotency-Key: <uuid>`. The first response is kept in Valkey 24 h
 * under `rr:idem:<userId>:<key>`, and the same request again gets it back
 * with `Idempotent-Replay: true` instead of being performed twice. The same
 * key with another request is `422 IDEMPOTENCY_KEY_REUSED`; while the first
 * is still running a second is `409 CONFLICT`.
 *
 * Only a successful response is kept. A failed one releases the key, so a
 * retry after a panel or provider error is performed, not answered with the
 * error; where a repeat must not happen whatever the outcome, the service
 * has its own guard (`invoices.idempotency_key`, `trial_used_at`).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly infra: Infrastructure,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest & { body?: unknown }>();
    const reply = http.getResponse<FastifyReply>();
    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    if (key === undefined || key === '') {
      if (this.reflector.get<boolean | undefined>(REQUIRED, context.getHandler()))
        throw invalidKey('is required');
      return next.handle();
    }
    if (!UUID.test(key)) throw invalidKey('must be a UUID');

    const owner = await this.owner(request);
    const storeKey = `rr:idem:${owner}:${key.toLowerCase()}`;
    const fingerprint = createHash('sha256')
      .update(
        `${request.method} ${request.url.split('?')[0] ?? ''} ${JSON.stringify(request.body ?? null)}`,
      )
      .digest('hex');
    const pending: Entry = { state: 'pending', fingerprint };
    const claimed = await this.infra.redis.set(
      storeKey,
      JSON.stringify(pending),
      'EX',
      TTL_SECONDS,
      'NX',
    );
    if (claimed !== 'OK') {
      const stored = await this.infra.redis.get(storeKey);
      if (stored) return of(replay(JSON.parse(stored) as Entry, fingerprint, reply));
      // Released between the two calls: the first failed; perform this one.
      return this.intercept(context, next);
    }

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        const done: Entry = { state: 'done', fingerprint, body };
        await this.infra.redis.set(storeKey, JSON.stringify(done), 'EX', TTL_SECONDS);
        return body;
      }),
      catchError((error: unknown) =>
        from(
          this.infra.redis.del(storeKey).then(() => {
            throw error;
          }),
        ),
      ),
    );
  }

  /** The user the key belongs to: signed in, or acting through the bot. */
  private async owner(request: AuthenticatedRequest): Promise<string> {
    if (request.user?.id) return request.user.id;
    const acting = request.headers['x-acting-user'];
    const telegramId = Array.isArray(acting) ? acting[0] : acting;
    if (!telegramId || !/^\d+$/u.test(telegramId))
      throw new ApiError('FORBIDDEN', HttpStatus.FORBIDDEN);
    const user = await this.infra.db.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { id: true },
    });
    if (!user) throw new ApiError('NOT_FOUND', HttpStatus.NOT_FOUND);
    return user.id;
  }
}

function replay(entry: Entry, fingerprint: string, reply: FastifyReply): unknown {
  if (entry.fingerprint !== fingerprint)
    throw new ApiError('IDEMPOTENCY_KEY_REUSED', HttpStatus.UNPROCESSABLE_ENTITY);
  if (entry.state === 'pending')
    throw new ApiError(
      'CONFLICT',
      HttpStatus.CONFLICT,
      'A request with this Idempotency-Key is in progress.',
    );
  void reply.header('Idempotent-Replay', 'true');
  return entry.body;
}

function invalidKey(message: string): ApiError {
  return new ApiError('VALIDATION_ERROR', HttpStatus.BAD_REQUEST, `Idempotency-Key ${message}`, [
    { path: ['Idempotency-Key'], message },
  ]);
}
