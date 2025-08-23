import { Resolver, Query, Mutation, Args, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationConnection, NotificationsArgs } from './dto/notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const pubSub = new PubSub();

@Resolver(() => Notification)
@UseGuards(JwtAuthGuard)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationConnection)
  async notifications(
    @CurrentUser() user: any,
    @Args() args: NotificationsArgs,
  ): Promise<NotificationConnection> {
    return this.notificationsService.findMany(user.id, args);
  }

  @Mutation(() => Boolean)
  async markNotificationAsRead(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.notificationsService.markAsRead(id, user.id);
  }

  @Mutation(() => Boolean)
  async markAllNotificationsAsRead(@CurrentUser() user: any): Promise<boolean> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Subscription(() => Notification, {
    filter: (payload, variables, context) => {
      return payload.notificationAdded.userId === context.req.user.id;
    },
  })
  notificationAdded() {
    return pubSub.asyncIterator('notificationAdded');
  }
}