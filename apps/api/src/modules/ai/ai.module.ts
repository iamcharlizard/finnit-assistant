import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  AI_PROVIDERS,
  AiModelsService,
  defaultProviders,
} from './ai-models.service';
import { AiModelsResolver } from './ai-models.resolver';
import { AiFeaturesService } from './ai-features.service';
import { AiProviderClient } from './providers/ai-provider';

@Module({
  providers: [
    { provide: AI_PROVIDERS, useFactory: defaultProviders },
    {
      provide: AiModelsService,
      useFactory: (prisma: PrismaService, providers: AiProviderClient[]) =>
        new AiModelsService(prisma, providers),
      inject: [PrismaService, AI_PROVIDERS],
    },
    AiModelsResolver,
    AiFeaturesService,
    PrismaService,
  ],
  exports: [AiModelsService],
})
export class AiModule {}
