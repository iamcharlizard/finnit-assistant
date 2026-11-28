import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { GlobalSettingsResolver } from './global-settings.resolver';
import { GlobalSettingsService } from './global-settings.service';

@Module({
  providers: [GlobalSettingsService, GlobalSettingsResolver, PrismaService],
  exports: [GlobalSettingsService],
})
export class GlobalSettingsModule {}
