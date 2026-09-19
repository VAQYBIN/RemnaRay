import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

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

@Module({
  imports: [
    SettingsModule,
    UsersModule,
    ThrottlerModule.forRoot({
      storage: throttlerStorage,
      throttlers: [{ name: 'default', ttl: 10_000, limit: 100 }],
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
    {
      provide: AuthGuard,
      inject: ['SESSION_STORE'],
      useFactory: (sessions: SessionStorePort) =>
        new AuthGuard(sessions, process.env.RR_APP_KEY ?? ''),
    },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    InternalTokenGuard,
  ],
  exports: [AuthService, AuthGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
