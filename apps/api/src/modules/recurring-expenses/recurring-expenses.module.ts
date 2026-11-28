import { Module } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesResolver } from './recurring-expenses.resolver';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';
import { RecurringLinksResolver } from './recurring-links.resolver';
import { RecurringLinksService } from './recurring-links.service';
import { RecurringSuggestionsService } from './suggestions/recurring-suggestions.service';
import { RecurringSuggestionsResolver } from './suggestions/recurring-suggestions.resolver';
import { AiModule } from '../ai/ai.module';
import { RecurringEssentialsResolver } from './essentials/recurring-essentials.resolver';
import { RecurringEssentialsService } from './essentials/recurring-essentials.service';

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
    RecurringEssentialsService,
    RecurringEssentialsResolver,
  ],
  exports: [RecurringExpensesService, RecurringSuggestionsService],
})
export class RecurringExpensesModule {}
