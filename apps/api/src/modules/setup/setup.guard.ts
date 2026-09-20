import { type CanActivate, type ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { SettingsService } from '../settings/settings.service';

/** Paths that answer normally while the wizard is still running (section 17.4). */
function openDuringSetup(path: string): boolean {
  return path.startsWith('/api/setup/') || path.startsWith('/api/v1/health');
}

/**
 * Section 17.4 and the section 9.3 error table: while `setup.completed` is
 * false everything but the wizard and the health probes answers
 * `SETUP_NOT_COMPLETED` 503, and once it is true the wizard itself answers
 * `SETUP_ALREADY_COMPLETED` 404.
 */
@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private readonly settings: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const path = request.routeOptions.url ?? request.url.split('?')[0] ?? '';
    const completed = (await this.settings.get('setup.completed')) === true;
    if (path.startsWith('/api/setup/')) {
      if (completed) throw new HttpException({ error: { code: 'SETUP_ALREADY_COMPLETED' } }, 404);
      return true;
    }
    if (completed || openDuringSetup(path)) return true;
    throw new HttpException({ error: { code: 'SETUP_NOT_COMPLETED' } }, 503);
  }
}
