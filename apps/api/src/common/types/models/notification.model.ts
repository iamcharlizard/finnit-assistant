import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Notification {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field()
  type: string; // NotificationType enum

  @Field()
  status: string; // NotificationStatus enum

  @Field({ nullable: true })
  relatedEntityId?: string;

  @Field({ nullable: true })
  relatedEntityType?: string;

  @Field({ nullable: true })
  scheduledAt?: Date;

  @Field({ nullable: true })
  sentAt?: Date;

  @Field()
  createdAt: Date;
}
