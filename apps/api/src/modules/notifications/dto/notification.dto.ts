import {
  ObjectType,
  Field,
  registerEnumType,
  ArgsType,
  Int,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';
import {
  Connection,
  Edge,
  PageInfo,
} from '../../../common/types/pagination.types';
import { NotificationType, NotificationStatus } from '@finnit/database';

registerEnumType(NotificationType, {
  name: 'NotificationType',
  description: 'Notification type',
});

registerEnumType(NotificationStatus, {
  name: 'NotificationStatus',
  description: 'Notification status',
});

@ObjectType()
export class Notification {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => NotificationType)
  type: NotificationType;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => NotificationStatus)
  status: NotificationStatus;

  @Field({ nullable: true })
  scheduledAt?: Date;

  @Field({ nullable: true })
  sentAt?: Date;

  @Field({ nullable: true })
  relatedEntityId?: string;

  @Field({ nullable: true })
  relatedEntityType?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class NotificationEdge implements Edge<Notification> {
  @Field(() => Notification)
  node: Notification;

  @Field()
  cursor: string;
}

@ObjectType()
export class NotificationConnection implements Connection<Notification> {
  @Field(() => [NotificationEdge])
  edges: NotificationEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class NotificationsArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => NotificationStatus, { nullable: true })
  @IsOptional()
  status?: NotificationStatus;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'true: only notifications not read yet (scheduled or sent); overrides `status`',
  })
  @IsOptional()
  @IsBoolean()
  unread?: boolean | null;
}
