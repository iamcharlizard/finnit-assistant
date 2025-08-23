import { Module } from '@nestjs/common';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../services/prisma.service';

@Module({
  providers: [NotificationsResolver, NotificationsService, PrismaService],
})
export class NotificationsModule {}