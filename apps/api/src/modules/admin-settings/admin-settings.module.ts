import { Module } from '@nestjs/common';

import { NotifyModule } from '../notify/notify.module';
import { PaymentsModule } from '../payments/payments.module';
import { PublicModule } from '../public/public.module';
import { RemnawaveModule } from '../remnawave/remnawave.module';
import { SettingsModule } from '../settings/settings.module';
import {
  AdminAuditController,
  AdminBotController,
  AdminI18nController,
  AdminPanelController,
  AdminProvidersController,
  AdminSystemController,
  AdminThemeSettingsController,
} from './admin-settings.controller';
import { InternalProxyController } from './proxy.controller';
import { I18nAdminService } from './i18n-admin.service';
import { ProvidersService } from './providers.service';
import { SystemService } from './system.service';

@Module({
  imports: [SettingsModule, PaymentsModule, RemnawaveModule, PublicModule, NotifyModule],
  controllers: [
    AdminProvidersController,
    AdminPanelController,
    AdminBotController,
    AdminI18nController,
    AdminThemeSettingsController,
    AdminAuditController,
    AdminSystemController,
    InternalProxyController,
  ],
  providers: [ProvidersService, I18nAdminService, SystemService],
  exports: [ProvidersService, I18nAdminService, SystemService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AdminSettingsModule {}
