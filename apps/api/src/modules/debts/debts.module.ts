import { Module } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { DebtsResolver } from './debts.resolver';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [DebtsService, DebtsResolver, PrismaService],
  exports: [DebtsService],
})
export class DebtsModule {}