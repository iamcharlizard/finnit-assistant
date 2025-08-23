import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Attachment {
  @Field()
  id: string;

  @Field()
  transactionId: string;

  @Field()
  fileUrl: string;

  @Field()
  fileType: string;

  @Field({ nullable: true })
  fileSize?: number;

  @Field({ nullable: true })
  extra?: string;

  @Field()
  uploadedAt: Date;
}
