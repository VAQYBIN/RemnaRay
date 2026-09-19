import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { AdminThemesController, PublicThemeController } from './public.controller';
import { ThemeService } from './theme.service';

@Module({
  imports: [SettingsModule],
  controllers: [PublicThemeController, AdminThemesController],
  providers: [ThemeService],
  exports: [ThemeService],
})
// Nest module metadata is the complete implementation of this module.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PublicModule {}
