import { Module } from '@nestjs/common';
import { TransactionsResolver } from './transactions.resolver';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [TransactionsResolver, TransactionsService, PrismaService],
})
export class TransactionsModule {}