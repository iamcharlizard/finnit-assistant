import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AiModule } from '../ai/ai.module';
import { OcrModule } from '../ocr/ocr.module';
import { StatementsModule } from '../statements/statements.module';
import { StorageModule } from '../storage/storage.module';
import { ScreenshotsController } from './screenshots.controller';
import { ScreenshotsResolver } from './screenshots.resolver';
import { ScreenshotsService } from './screenshots.service';

/** Screenshots of a bank app's movement list → movements (docs/document-ocr.md). */
@Module({
  imports: [AiModule, OcrModule, StatementsModule, StorageModule],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService, ScreenshotsResolver, PrismaService],
})
export class ScreenshotsModule {}
