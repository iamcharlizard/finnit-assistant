import { Module } from '@nestjs/common';
import { UsersResolver } from './users/users.resolver';
import { UsersService } from './users/users.service';
import { AvatarService } from './users/avatar.service';
import { AvatarController } from './users/avatar.controller';
import { StorageModule } from './storage/storage.module';
import { PrismaService } from '../services/prisma.service';

@Module({
  imports: [StorageModule],
  controllers: [AvatarController],
  providers: [UsersResolver, UsersService, AvatarService, PrismaService],
})
export class UsersModule {}
