import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';

export type ForwardedObservation = {
  at: string;
  clientIp: string;
  protocol: string;
  forwardedFor: boolean;
  forwardedProto: boolean;
};

/**
 * Section 21.7: `/admin/system` has to answer "are `X-Forwarded-Proto` and
 * `X-Forwarded-For` arriving?" for the last request, so an owner behind their
 * own proxy can see whether it is configured before anything goes wrong.
 */
@Injectable()
export class ForwardedObserver {
  private observation: ForwardedObservation | null = null;

  record(value: ForwardedObservation): void {
    this.observation = value;
  }

  last(): ForwardedObservation | null {
    return this.observation;
  }
}

@Injectable()
export class ForwardedInterceptor implements NestInterceptor {
  constructor(private readonly observer: ForwardedObserver) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<FastifyRequest>();
      this.observer.record({
        at: new Date().toISOString(),
        // `request.ip` is already the resolved address: Fastify only believes
        // the header when the peer is in `RR_TRUSTED_PROXIES`.
        clientIp: request.ip,
        protocol: request.protocol,
        forwardedFor: request.headers['x-forwarded-for'] !== undefined,
        forwardedProto: request.headers['x-forwarded-proto'] !== undefined,
      });
    }
    return next.handle();
  }
}
