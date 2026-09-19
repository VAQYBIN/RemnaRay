import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AdminAuthController } from './admin.controller';
import { AdminAuthService } from './admin.auth.service';
import { AuditInterceptor } from './audit.interceptor';
import { RbacGuard } from './admin.rbac';

@Module({
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AdminAuthService, RbacGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AdminModule {}
