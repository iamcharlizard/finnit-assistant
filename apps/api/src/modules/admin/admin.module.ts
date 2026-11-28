import { Module } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersResolver } from './admin-users.resolver';

@Module({
  providers: [AdminUsersService, AdminUsersResolver],
})
export class AdminModule {}
