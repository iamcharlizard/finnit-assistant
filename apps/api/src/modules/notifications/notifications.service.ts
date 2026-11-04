import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../services/prisma.service';
import {
  Notification,
  NotificationConnection,
  NotificationsArgs,
} from './dto/notification.dto';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { NotificationStatus, NotificationType, Prisma } from '@finnit/database';

/** A notification about something, sent once per `relatedEntityId`. */
export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  /** What it is about (e.g. "account"). */
  relatedEntityType: string;
  /** Which one, and when it applies (e.g. "<account id>:<day>"). */
  relatedEntityId: string;
}

/** Not read yet: waiting to be sent or sent. */
const UNREAD_STATUSES: NotificationStatus[] = [
  NotificationStatus.scheduled,
  NotificationStatus.sent,
];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the notification unless one about the same thing already exists
   * (same `relatedEntityType` and `relatedEntityId`). True when created.
   */
  async notify(
    input: NotifyInput,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<boolean> {
    const existing = await client.notification.findFirst({
      where: {
        userId: input.userId,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      },
      select: { id: true },
    });
    if (existing) return false;
    await client.notification.create({
      data: { ...input, status: NotificationStatus.sent, sentAt: new Date() },
    });
    return true;
  }

  /**
   * Newest first, keyset-paginated on (createdAt, id) through the cursor row,
   * so pages never skip or repeat notifications. One extra row tells whether
   * another page exists.
   */
  async findMany(
    userId: string,
    args: NotificationsArgs,
  ): Promise<NotificationConnection> {
    const where: Prisma.NotificationWhereInput = { userId };

    if (args.unread) {
      where.status = { in: UNREAD_STATUSES };
    } else if (args.status) {
      where.status = args.status;
    }

    const limit = args.first || 20;
    const [rows, totalCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take: limit + 1,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(args.after && {
          cursor: { id: PaginationUtil.decodeCursor(args.after) },
          skip: 1,
        }),
      }),
      this.prisma.notification.count({ where }),
    ]);

    const page = rows.slice(0, limit);
    const connection = PaginationUtil.createConnection(
      page.map((notification) => this.mapNotification(notification)),
      { ...args, first: limit },
      totalCount,
      (notification) => PaginationUtil.encodeCursor(notification.id),
    );
    connection.pageInfo.hasNextPage = rows.length > limit;
    return connection;
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

  private mapNotification(
    notification: Prisma.NotificationGetPayload<Record<string, never>>,
  ): Notification {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      scheduledAt: notification.scheduledAt || undefined,
      sentAt: notification.sentAt || undefined,
      relatedEntityId: notification.relatedEntityId || undefined,
      relatedEntityType: notification.relatedEntityType || undefined,
      createdAt: notification.createdAt,
    };
  }
}
