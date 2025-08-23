import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import { Notification, NotificationConnection, NotificationsArgs } from './dto/notification.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(userId: string, args: NotificationsArgs): Promise<NotificationConnection> {
    const where: any = { userId };
    
    if (args.status) {
      where.status = args.status;
    }

    const limit = args.first || 20;
    let cursor: any = undefined;
    
    if (args.after) {
      const decodedCursor = PaginationUtil.decodeCursor(args.after);
      cursor = { id: { gt: decodedCursor } };
    }

    const notifications = await this.prisma.notification.findMany({
      where: { ...where, ...cursor },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = await this.prisma.notification.count({ where });

    return PaginationUtil.createConnection(
      notifications.map(this.mapNotification),
      args,
      totalCount,
      (notification) => PaginationUtil.encodeCursor(notification.id),
    );
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { status: 'read' },
    });

    return true;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    await this.prisma.notification.updateMany({
      where: { userId, status: { not: 'read' } },
      data: { status: 'read' },
    });

    return true;
  }

  private mapNotification(notification: any): Notification {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      scheduledAt: notification.scheduledAt,
      sentAt: notification.sentAt,
      relatedEntityId: notification.relatedEntityId,
      relatedEntityType: notification.relatedEntityType,
      createdAt: notification.createdAt,
    };
  }
}