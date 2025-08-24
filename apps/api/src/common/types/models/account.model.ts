import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { AccountType } from '@finnit/database';
import { AccountMetadata } from './account-metadata.model';
import { CreditCardTerms } from './credit-card-terms.model';

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

  @Field(() => AccountMetadata, { nullable: true })
  metadata?: AccountMetadata;

  @Field()
  archived: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => CreditCardTerms, { nullable: true })
  creditCardTerms?: CreditCardTerms;
}
