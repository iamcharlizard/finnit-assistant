import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AiModelsService } from '../ai/ai-models.service';
import { TranslationService } from './translation.service';

@Module({
  imports: [AiModule],
  providers: [
    {
      provide: TranslationService,
      useFactory: (aiModels: AiModelsService) =>
        new TranslationService(aiModels),
      inject: [AiModelsService],
    },
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
