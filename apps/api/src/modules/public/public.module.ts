import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import {
  AdminThemesController,
  PublicController,
  PublicReferralController,
} from './public.controller';
import { I18nService } from './i18n.service';
import { ThemeService } from './theme.service';

@Module({
  imports: [SettingsModule],
  controllers: [PublicController, PublicReferralController, AdminThemesController],
  providers: [ThemeService, I18nService],
  exports: [ThemeService, I18nService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PublicModule {}
