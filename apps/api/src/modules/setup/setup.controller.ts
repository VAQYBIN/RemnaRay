import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { readCookie } from '../auth/auth.guards';
import { SetupService } from './setup.service';

const SESSION_COOKIE = 'rr_setup';

function clientIp(request: FastifyRequest): string {
  return request.ip || request.raw.socket.remoteAddress || 'unknown';
}

/** Section 9.3 base path: the wizard lives under `/api/setup/v1/*`. */
@Controller('api/setup/v1')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('state')
  state(@Headers('cookie') cookie: string | undefined) {
    return this.setup.state(session(cookie));
  }

  @Post('token')
  @HttpCode(200)
  async token(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { sessionId } = await this.setup.token(body, clientIp(request));
    reply.header(
      'set-cookie',
      `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=3600`,
    );
    return { accepted: true, state: await this.setup.state(sessionId) };
  }

  @Post('steps/:step')
  @HttpCode(200)
  submit(
    @Param('step') step: string,
    @Body() body: unknown,
    @Headers('cookie') cookie: string | undefined,
  ) {
    return this.setup.submit(step, body, session(cookie));
  }

  @Post('check/panel')
  @HttpCode(200)
  checkPanel(@Body() body: unknown, @Headers('cookie') cookie: string | undefined) {
    return this.setup.checkPanel(body, session(cookie));
  }

  @Post('check/bot')
  @HttpCode(200)
  checkBot(@Body() body: unknown, @Headers('cookie') cookie: string | undefined) {
    return this.setup.checkBot(body, session(cookie));
  }

  @Post('check/provider')
  @HttpCode(200)
  checkProvider(@Body() body: unknown, @Headers('cookie') cookie: string | undefined) {
    return this.setup.checkProvider(body, session(cookie));
  }

  /** Section 17.4 step 5: the optional PNG/SVG logo upload. */
  @Post('theme-logo')
  @HttpCode(200)
  async themeLogo(@Headers('cookie') cookie: string | undefined, @Req() request: FastifyRequest) {
    let themeSlug = '';
    let uploaded: { filename: string; mimetype: string; contents: Buffer } | undefined;
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        if (uploaded) throw new Error('Only one logo file is allowed');
        uploaded = {
          filename: part.filename,
          mimetype: part.mimetype,
          contents: await part.toBuffer(),
        };
      } else if (part.fieldname === 'theme') {
        themeSlug = String(part.value);
      }
    }
    if (!uploaded) throw new Error('A logo file is required');
    return this.setup.uploadLogo(
      session(cookie),
      themeSlug,
      uploaded.filename,
      uploaded.mimetype,
      uploaded.contents,
    );
  }

  @Post('finish')
  @HttpCode(200)
  async finish(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.setup.finish(session(cookie));
    reply.header('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return result;
  }
}

function session(cookie: string | undefined): string {
  return readCookie(cookie, SESSION_COOKIE) ?? '';
}
