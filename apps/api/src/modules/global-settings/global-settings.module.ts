import { Module } from '@nestjs/common';
import { GlobalSettingsResolver } from './global-settings.resolver';
import { GlobalSettingsService } from './global-settings.service';

@Module({
  providers: [GlobalSettingsService, GlobalSettingsResolver],
  exports: [GlobalSettingsService],
})
export class GlobalSettingsModule {}
