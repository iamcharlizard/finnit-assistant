import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { NotificationStatus, NotificationType } from '@finnit/database';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../services/prisma.service';
import { PaginationUtil } from '../../common/utils/pagination.util';

const row = (id: string, minutesAgo: number) => ({
  id,
  userId: 'user-1',
  type: NotificationType.recurring,
  title: `Title ${id}`,
  message: `Message ${id}`,
  status: NotificationStatus.sent,
  scheduledAt: null,
  sentAt: null,
  relatedEntityId: null,
  relatedEntityType: null,
  createdAt: new Date(Date.UTC(2026, 9, 13, 12, 0) - minutesAgo * 60_000),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  const findManyArgs = () => {
    const [args] = prisma.notification.findMany.mock.calls[0] ?? [];
    return args as {
      where: Record<string, unknown>;
      take: number;
      cursor?: { id: string };
      skip?: number;
      orderBy: unknown;
    };
  };

  it('lists newest first and asks one row more to know if a next page exists', async () => {
    prisma.notification.findMany.mockResolvedValue([
      row('a', 1),
      row('b', 2),
      row('c', 3),
    ] as never);
    prisma.notification.count.mockResolvedValue(5);

    const result = await service.findMany('user-1', { first: 2 });

    expect(findManyArgs()).toMatchObject({
      where: { userId: 'user-1' },
      take: 3,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(result.edges.map((e) => e.node.id)).toEqual(['a', 'b']);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.endCursor).toBe(PaginationUtil.encodeCursor('b'));
    expect(result.totalCount).toBe(5);
  });

  it('continues after the cursor row instead of comparing ids', async () => {
    prisma.notification.findMany.mockResolvedValue([row('c', 3)] as never);
    prisma.notification.count.mockResolvedValue(3);

    const result = await service.findMany('user-1', {
      first: 2,
      after: PaginationUtil.encodeCursor('b'),
    });

    expect(findManyArgs()).toMatchObject({ cursor: { id: 'b' }, skip: 1 });
    expect(findManyArgs().where).not.toHaveProperty('id');
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('unread: only scheduled or sent, whatever the status argument says', async () => {
    prisma.notification.findMany.mockResolvedValue([] as never);
    prisma.notification.count.mockResolvedValue(0);

    await service.findMany('user-1', {
      unread: true,
      status: NotificationStatus.read,
    });

    expect(findManyArgs().where).toEqual({
      userId: 'user-1',
      status: {
        in: [NotificationStatus.scheduled, NotificationStatus.sent],
      },
    });
  });

  it('filters by one status', async () => {
    prisma.notification.findMany.mockResolvedValue([] as never);
    prisma.notification.count.mockResolvedValue(0);

    await service.findMany('user-1', { status: NotificationStatus.read });

    expect(findManyArgs().where).toEqual({
      userId: 'user-1',
      status: NotificationStatus.read,
    });
  });

  it('marks only the user’s notification as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.markAsRead('n-1', 'user-1')).resolves.toBe(true);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n-1', userId: 'user-1' },
      data: { status: 'read' },
    });
  });
});
