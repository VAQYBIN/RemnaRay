import {
  CallHandler,
  ExecutionContext,
  Injectable,
  SetMetadata,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mergeMap } from 'rxjs';
import type { FastifyRequest } from 'fastify';

import { Infrastructure } from '../../infra/infra.module';

export const AUDIT_KEY = 'remnaray:audit';
const MAX_JSON_BYTES = 16 * 1024;

export function Audit(action: string, entity: string, idParam?: string) {
  return SetMetadata(AUDIT_KEY, { action, entity, idParam });
}

/**
 * Section 14.3 requires `before` to be the state the handler read *before* the
 * change, not the request body. A handler returns this wrapper; the interceptor
 * stores both sides and answers with `body`.
 */
export class Audited<TBody = unknown> {
  readonly body: TBody;

  constructor(
    readonly before: unknown,
    readonly after: unknown,
    body?: TBody,
  ) {
    this.body = (body === undefined ? after : body) as TBody;
  }
}

type AuditMetadata = { action: string; entity: string; idParam?: string };
type RequestWithAdmin = FastifyRequest & {
  admin?: { id: string };
  params?: Record<string, string>;
  body?: unknown;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor<unknown, unknown> {
  constructor(
    private readonly infra: Infrastructure,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>) {
    const request = context.switchToHttp().getRequest<RequestWithAdmin>();
    const path = request.routeOptions.url ?? request.url.split('?')[0] ?? '';
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (!request.admin || !isMutation || !path.startsWith('/api/admin/')) {
      return next.handle();
    }

    const metadata = this.reflector.get<AuditMetadata | undefined>(AUDIT_KEY, context.getHandler());
    return next.handle().pipe(
      mergeMap(async (response) => {
        const audited = response instanceof Audited ? response : undefined;
        const action = metadata?.action ?? `${request.method.toLowerCase()} ${path}`;
        const entity = metadata?.entity ?? 'admin';
        const entityId = metadata?.idParam ? request.params?.[metadata.idParam] : undefined;
        const before = truncate(sanitize(audited ? audited.before : undefined));
        const after = truncate(sanitize(audited ? audited.after : response));
        const body = request.body;
        const reason =
          typeof body === 'object' && body !== null && 'reason' in body
            ? (body as { reason?: unknown }).reason
            : undefined;
        await this.infra.db.auditLog.create({
          data: {
            ...(request.admin?.id ? { actorAdminId: request.admin.id } : {}),
            actorType: 'admin',
            action,
            entity,
            ...(entityId ? { entityId } : {}),
            ...(before === undefined ? {} : { before: before as never }),
            ...(after === undefined ? {} : { after: after as never }),
            ...(typeof reason === 'string' && reason ? { reason } : {}),
            ...(request.ip ? { ip: request.ip } : {}),
            ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
          },
        });
        return audited ? (audited.body as unknown) : response;
      }),
    );
  }
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (typeof value === 'string')
    return value.length > MAX_JSON_BYTES ? `${value.slice(0, MAX_JSON_BYTES)}…` : value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/authorization|cookie|password|secret|token|totp|api[-_]?key/i.test(key))
      output[key] = '***';
    else output[key] = sanitize(item, depth + 1);
  }
  return output;
}

/** Section 14.3: large objects are cut down to 16 KB before they are stored. */
function truncate(value: unknown): unknown {
  if (value === undefined) return undefined;
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') <= MAX_JSON_BYTES) return value;
  return { truncated: true, bytes: Buffer.byteLength(serialized, 'utf8') };
}
