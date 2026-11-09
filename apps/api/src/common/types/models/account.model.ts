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

  @Field({
    description:
      'The user\'s cash account ("Efectivo"): always there; can\'t be deleted or archived',
  })
  isDefaultCash: boolean;

  @Field({
    description:
      'Whether it adds up to the total balance (home, accounts overview)',
  })
  includeInTotal: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => CreditCardTerms, { nullable: true })
  creditCardTerms?: CreditCardTerms;
}
