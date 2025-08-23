import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { AccountType } from '@finnit/database';

registerEnumType(AccountType, {
  name: 'AccountType',
  description: 'Account type',
});

@ObjectType()
export class Account {
  @Field()
  id: string;

  @Field()
  userId: string;

  @Field(() => AccountType)
  type: AccountType;

  @Field()
  name: string;

  @Field()
  currency: string;

  @Field()
  balanceCurrent: number;

  @Field({ nullable: true })
  metadata?: string;

  @Field()
  archived: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
