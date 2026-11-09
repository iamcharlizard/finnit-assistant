import { Module } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesResolver } from './recurring-expenses.resolver';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';
import { RecurringLinksResolver } from './recurring-links.resolver';
import { RecurringLinksService } from './recurring-links.service';
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
    RecurringLinksService,
    RecurringLinksResolver,
    RecurringSuggestionsService,
    RecurringSuggestionsResolver,
    PrismaService,
  ],
  exports: [RecurringExpensesService, RecurringSuggestionsService],
})
export class RecurringExpensesModule {}
