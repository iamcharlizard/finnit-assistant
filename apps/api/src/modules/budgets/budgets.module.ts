import { Module } from '@nestjs/common';
import { BudgetsResolver } from './budgets.resolver';
import { BudgetsService } from './budgets.service';

@Module({
  providers: [BudgetsResolver, BudgetsService],
})
export class BudgetsModule {}
