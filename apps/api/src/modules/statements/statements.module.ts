import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AiModule } from '../ai/ai.module';
import { CategoriesModule } from '../categories/categories.module';
import { CategorizationModule } from '../categorization/categorization.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { StorageModule } from '../storage/storage.module';
import { StatementParserRegistry } from './parsing/statement-parser.registry';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { OcrModule } from '../ocr/ocr.module';
import { LineMaterializerService } from './reconciliation/line-materializer.service';
import { StatementsController } from './statements.controller';
import { StatementsResolver } from './statements.resolver';
import { StatementsService } from './statements.service';

@Module({
  imports: [
    AiModule,
    CategoriesModule,
    CategorizationModule,
    OcrModule,
    RecurringExpensesModule,
    StorageModule,
  ],
  controllers: [StatementsController],
  providers: [
    StatementsService,
    StatementsResolver,
    StatementParserRegistry,
    ReconciliationService,
    LineMaterializerService,
    PrismaService,
  ],
  exports: [ReconciliationService, LineMaterializerService],
})
export class StatementsModule {}
