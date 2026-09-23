import { Module, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';

import { SettingsModule } from '../settings/settings.module';
import { SettingsService } from '../settings/settings.service';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { AuthController, InternalAuthController } from './auth.controller';
import { AuthGuard, CsrfGuard, InternalTokenGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { RedisSessionStore, type SessionStorePort } from './auth.session';
import { ValkeyThrottlerStorage } from './auth.throttler';

const sessionStore = new RedisSessionStore();
const throttlerStorage = new ValkeyThrottlerStorage();

/** Internal workers authenticate with a token and have their own job cadence. */
export function skipThrottleForInternal(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  const path = request.routeOptions.url ?? request.url.split('?')[0] ?? '';
  return path.startsWith('/api/internal/');
}

@Module({
  imports: [
    SettingsModule,
    UsersModule,
    ThrottlerModule.forRoot({
      storage: throttlerStorage,
      throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
      skipIf: skipThrottleForInternal,
    }),
  ],
  controllers: [AuthController, InternalAuthController],
  providers: [
    { provide: 'SESSION_STORE', useValue: sessionStore },
    {
      provide: AuthService,
      inject: [SettingsService, UsersService, 'SESSION_STORE'],
      useFactory: (settings: SettingsService, users: UsersService, sessions: SessionStorePort) =>
        new AuthService(settings, users, sessions, process.env.RR_APP_KEY ?? ''),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    InternalTokenGuard,
  ],
  exports: [AuthService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
