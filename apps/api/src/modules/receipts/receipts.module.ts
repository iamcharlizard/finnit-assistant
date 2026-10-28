import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AiModule } from '../ai/ai.module';
import { CategorizationModule } from '../categorization/categorization.module';
import { OcrModule } from '../ocr/ocr.module';
import { StorageModule } from '../storage/storage.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsResolver } from './receipts.resolver';
import { ReceiptsService } from './receipts.service';

/** Receipt photos → draft transactions (feature 14, docs/document-ocr.md). */
@Module({
  imports: [
    AiModule,
    CategorizationModule,
    OcrModule,
    StorageModule,
    TransactionsModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, ReceiptsResolver, PrismaService],
})
export class ReceiptsModule {}
