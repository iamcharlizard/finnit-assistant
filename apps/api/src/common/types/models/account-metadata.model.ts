import { ObjectType, Field, InputType } from '@nestjs/graphql';

@ObjectType()
export class AccountMetadata {
  @Field({ nullable: true })
  bank?: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  last4?: string;

  @Field({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  accountNumber?: string;

  @Field({ nullable: true })
  interestRate?: number;

  @Field({ nullable: true })
  creditLimit?: number;

  @Field({ nullable: true })
  provider?: string;
}

@InputType()
export class AccountMetadataInput {
  @Field({ nullable: true })
  bank?: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  last4?: string;

  @Field({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  accountNumber?: string;

  @Field({ nullable: true })
  interestRate?: number;

  @Field({ nullable: true })
  creditLimit?: number;

  @Field({ nullable: true })
  provider?: string;
}
