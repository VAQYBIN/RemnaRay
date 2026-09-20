import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { observeHttpRequest } from '@remnaray/metrics';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

/**
 * Section 9.9 `rr_http_requests_total{route,status}` and
 * `rr_http_request_duration_seconds`.
 *
 * The label is the route template Fastify matched, not the path that was
 * asked for: `/admin/users/<uuid>` is one series, and a label taken from the
 * URL is how a metrics endpoint becomes the thing that falls over. A request
 * that matched no route is counted under `unmatched` for the same reason.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const route = request.routeOptions.url ?? 'unmatched';
    const startedAt = process.hrtime.bigint();

    const observe = (status: number) => {
      observeHttpRequest(route, status, Number(process.hrtime.bigint() - startedAt) / 1e9);
    };

    return next.handle().pipe(
      tap({
        next: () => {
          observe(reply.statusCode);
        },
        // An exception filter has not run yet, so the reply still carries the
        // status of the route rather than of the error; the error names it.
        error: (error: unknown) => {
          const status =
            typeof error === 'object' && error !== null && 'status' in error
              ? Number(error.status)
              : 500;
          observe(Number.isFinite(status) ? status : 500);
        },
      }),
    );
  }
}
