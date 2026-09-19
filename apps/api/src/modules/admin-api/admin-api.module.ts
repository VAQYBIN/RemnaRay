import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { RemnawaveModule } from '../remnawave/remnawave.module';
import { SettingsModule } from '../settings/settings.module';
import {
  AdminDashboardController,
  AdminPaymentsController,
  AdminUsersController,
} from './admin-api.controller';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminUsersService } from './admin-users.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SettingsModule, PaymentsModule, RemnawaveModule],
  controllers: [AdminDashboardController, AdminUsersController, AdminPaymentsController],
  providers: [DashboardService, AdminUsersService, AdminPaymentsService],
  exports: [DashboardService, AdminUsersService, AdminPaymentsService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AdminApiModule {}
