import { Module } from '@nestjs/common';
import { UsersResolver } from './users/users.resolver';
import { UsersService } from './users/users.service';
import { PrismaService } from '../services/prisma.service';

@Module({
  providers: [UsersResolver, UsersService, PrismaService],
})
export class UsersModule {}
