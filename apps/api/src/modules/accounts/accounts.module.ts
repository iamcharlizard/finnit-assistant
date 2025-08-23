import { Module } from '@nestjs/common';
import { AccountsResolver } from './accounts.resolver';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [AccountsResolver, AccountsService, PrismaService],
})
export class AccountsModule {}