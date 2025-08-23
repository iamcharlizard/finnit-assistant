import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationConnection,
  NotificationsArgs,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

interface NotificationPayload {
  notificationAdded: {
    userId: string;
  };
}

interface SubscriptionContext {
  req: {
    user: {
      id: string;
    };
  };
}

const pubSub = new PubSub();

@Resolver(() => Notification)
@UseGuards(JwtAuthGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationConnection)
  async notifications(
    @CurrentUser() user: User,
    @Args() args: NotificationsArgs,
  ): Promise<NotificationConnection> {
    return this.notificationsService.findMany(user.id, args);
  }

  @Mutation(() => Boolean)
  async markNotificationAsRead(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Mutation(() => Boolean)
  async markAllNotificationsAsRead(
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Subscription(() => Notification, {
    filter: (
      payload: NotificationPayload,
      variables,
      context: SubscriptionContext,
    ) => {
      return payload.notificationAdded.userId === context.req.user.id;
    },
  })
  notificationAdded() {
    return pubSub.asyncIterator('notificationAdded');
  }
}
