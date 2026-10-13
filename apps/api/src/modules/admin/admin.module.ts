import { Module } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersResolver } from './admin-users.resolver';

@Module({
  providers: [AdminUsersService, AdminUsersResolver, PrismaService],
})
export class AdminModule {}
