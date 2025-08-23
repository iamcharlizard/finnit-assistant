import { Module } from '@nestjs/common';
import { BudgetsResolver } from './budgets.resolver';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [BudgetsResolver, BudgetsService, PrismaService],
})
export class BudgetsModule {}