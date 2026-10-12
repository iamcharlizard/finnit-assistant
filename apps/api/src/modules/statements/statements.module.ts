import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { StorageModule } from '../storage/storage.module';
import { StatementParserRegistry } from './parsing/statement-parser.registry';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { StatementsController } from './statements.controller';
import { StatementsResolver } from './statements.resolver';
import { StatementsService } from './statements.service';

@Module({
  imports: [CategoriesModule, RecurringExpensesModule, StorageModule],
  controllers: [StatementsController],
  providers: [
    StatementsService,
    StatementsResolver,
    StatementParserRegistry,
    ReconciliationService,
    PrismaService,
  ],
  exports: [ReconciliationService],
})
export class StatementsModule {}
