import { Module } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpensesResolver } from './recurring-expenses.resolver';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [
    RecurringExpensesService,
    RecurringExpensesResolver,
    RecurringExpensesScheduler,
    PrismaService,
  ],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
