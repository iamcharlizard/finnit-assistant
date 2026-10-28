import { Module } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesResolver } from './recurring-expenses.resolver';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';
import { RecurringSuggestionsService } from './suggestions/recurring-suggestions.service';
import { RecurringSuggestionsResolver } from './suggestions/recurring-suggestions.resolver';
import { PrismaService } from '../../services/prisma.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [
    RecurringExpensesService,
    RecurringExpensesResolver,
    RecurringExpensesScheduler,
    RecurringSuggestionsService,
    RecurringSuggestionsResolver,
    PrismaService,
  ],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
