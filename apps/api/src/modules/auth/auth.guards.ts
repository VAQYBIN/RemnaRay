import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AuthFailure, verifyJwt } from './auth.crypto';
import type { SessionStorePort } from './auth.session';

export type AuthenticatedRequest = FastifyRequest & {
  user?: { id: string; sessionId?: string; session?: unknown };
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionStorePort,
    private readonly appKey: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = headerValue(request.headers.authorization);
    if (authorization?.startsWith('Bearer ')) {
      try {
        const claims = verifyJwt(authorization.slice(7), this.appKey);
        request.user = { id: claims.sub };
        return true;
      } catch (error) {
        if (error instanceof AuthFailure) throw new UnauthorizedException(error.code);
      }
    }

    const sessionId = readCookie(request.headers.cookie, 'rr_sid');
    if (!sessionId) throw new UnauthorizedException('UNAUTHENTICATED');
    const session = await this.sessions.get(sessionId);
    if (!session) throw new UnauthorizedException('UNAUTHENTICATED');
    request.user = { id: session.userId, sessionId, session };
    return true;
  }
}

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const path = request.url.split('?')[0] ?? request.url;
    if (
      path.includes('/auth/telegram') ||
      path.includes('/internal/') ||
      path.includes('/webhooks/')
    ) {
      return true;
    }
    if (headerValue(request.headers['x-requested-with']) !== 'RemnaRay') {
      throw new ForbiddenException('FORBIDDEN');
    }
    const fetchSite = headerValue(request.headers['sec-fetch-site']);
    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    const origin = headerValue(request.headers.origin);
    if (origin && !isConfiguredOrigin(origin)) throw new ForbiddenException('FORBIDDEN');
    return true;
  }
}

export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = headerValue(request.headers['x-internal-token']);
    const expected = process.env.RR_INTERNAL_TOKEN;
    if (!expected || token !== expected) throw new UnauthorizedException('UNAUTHENTICATED');
    return true;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  return header
    ?.split(';')
    .map((item) => item.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

function isConfiguredOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === process.env.RR_DOMAIN || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}
