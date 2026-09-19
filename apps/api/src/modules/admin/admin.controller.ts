import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import { type AuthenticatedRequest, readCookie } from '../auth/auth.guards';
import { AdminAuthService } from './admin.auth.service';

const ADMIN_COOKIE_MAX_AGE = 12 * 60 * 60;

@Controller('api/admin/v1/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: unknown) {
    return this.auth.login(body);
  }

  @Post('totp/setup')
  @HttpCode(200)
  setup(@Body() body: unknown) {
    return this.auth.setup(body);
  }

  @Post('totp')
  @HttpCode(200)
  async totp(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.totp(body);
    setAdminCookie(reply, result.sessionId);
    return { admin: result.admin, csrfToken: result.csrfToken };
  }

  @Post('totp/confirm')
  @HttpCode(200)
  async confirm(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.confirm(body);
    setAdminCookie(reply, result.sessionId);
    return { admin: result.admin, csrfToken: result.csrfToken };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(readCookie(request.headers.cookie, 'rr_asid'));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(readCookie(request.headers.cookie, 'rr_asid'));
    reply.header('set-cookie', 'rr_asid=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  }
}

function setAdminCookie(reply: FastifyReply, value: string): void {
  reply.header(
    'set-cookie',
    `rr_asid=${encodeURIComponent(value)}; Max-Age=${String(ADMIN_COOKIE_MAX_AGE)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}
