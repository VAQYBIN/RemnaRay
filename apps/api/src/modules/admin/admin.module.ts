import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AdminAuthController, AdminsController } from './admin.controller';
import { AdminAuthService } from './admin.auth.service';
import { AdminsService } from './admins.service';
import { AuditInterceptor } from './audit.interceptor';
import { RbacGuard } from './admin.rbac';

@Module({
  controllers: [AdminAuthController, AdminsController],
  providers: [
    AdminAuthService,
    AdminsService,
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AdminAuthService, AdminsService, RbacGuard],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AdminModule {}
