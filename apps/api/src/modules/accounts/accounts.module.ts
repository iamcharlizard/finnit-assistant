import { Module } from '@nestjs/common';
import { AccountsResolver } from './accounts.resolver';
import { AccountsService } from './accounts.service';

@Module({
  providers: [AccountsResolver, AccountsService],
})
export class AccountsModule {}
