import { Controller, Get, Headers, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Permissions } from '../admin/admin.rbac';
import { ThemeService } from './theme.service';

@Controller('api/v1/public')
export class PublicThemeController {
  constructor(private readonly themes: ThemeService) {}

  @Get('theme')
  async theme(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const tokens = await this.themes.active();
    reply.header('ETag', tokens.etag);
    reply.header('Cache-Control', 'public, max-age=60');
    if (ifNoneMatch === tokens.etag) {
      reply.status(304);
      return null;
    }
    return tokens;
  }
}

@Controller('api/admin/v1/themes')
@Permissions('themes.read')
export class AdminThemesController {
  constructor(private readonly themes: ThemeService) {}

  @Get()
  async list() {
    return { items: this.themes.list(), active: await this.themes.activeSlug() };
  }
}
