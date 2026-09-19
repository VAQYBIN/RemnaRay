import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import { AuthService } from './auth.service';
import { type AuthenticatedRequest, InternalTokenGuard } from './auth.guards';

const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

@Controller('api/v1')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/telegram')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async telegram(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.authenticateTelegram(body, {
      ip: request.ip,
      ...(request.headers['user-agent'] ? { userAgent: request.headers['user-agent'] } : {}),
    });
    setSessionCookie(reply, result.sessionId);
    return { user: result.user };
  }

  @Get('auth/tg')
  async telegramRedirect(@Query('token') token: string, @Res() reply: FastifyReply) {
    const sessionId = await this.auth.exchangeJwt(token);
    setSessionCookie(reply, sessionId);
    return reply.redirect('/account');
  }

  @Post('auth/logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.auth.logout(request.user?.sessionId);
    clearSessionCookie(reply);
    reply.code(204);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.auth.me(request.user?.id);
  }
}

@Controller('api/internal/v1/auth')
export class InternalAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('issue-token')
  @HttpCode(200)
  @UseGuards(InternalTokenGuard)
  issueToken(@Body() body: unknown) {
    return this.auth.issueBotToken(body);
  }
}

function setSessionCookie(reply: FastifyReply, value: string): void {
  reply.header(
    'set-cookie',
    `rr_sid=${encodeURIComponent(value)}; Max-Age=${String(SESSION_COOKIE_MAX_AGE)}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.header('set-cookie', 'rr_sid=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
}
