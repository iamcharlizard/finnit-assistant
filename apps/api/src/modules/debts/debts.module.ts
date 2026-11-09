import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { DebtsService } from './debts.service';
import { DebtsResolver } from './debts.resolver';
import { LoansService } from './loans.service';
import { LoanTrackingService } from './loan-tracking.service';
import { DebtInsightsService } from './debt-insights.service';
import { LoanLinksResolver } from './loan-links.resolver';
import { LoanLinksService } from './loan-links.service';
import { CardInstallmentsService } from './card-installments.service';
import { CardInstallmentsResolver } from './card-installments.resolver';
import { AiModule } from '../ai/ai.module';
import { PrismaService } from '../../services/prisma.service';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    RecurringExpensesModule,
    TransactionsModule,
    AiModule,
    ContactsModule,
  ],
  providers: [
    DebtsService,
    LoansService,
    LoanTrackingService,
    DebtInsightsService,
    DebtsResolver,
    LoanLinksService,
    LoanLinksResolver,
    CardInstallmentsService,
    CardInstallmentsResolver,
    PrismaService,
  ],
  exports: [DebtsService, CardInstallmentsService],
})
export class DebtsModule {}
