import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { BankConnectionStatus, BankProvider } from '@finnit/database';

registerEnumType(BankProvider, { name: 'BankProvider' });
registerEnumType(BankConnectionStatus, { name: 'BankConnectionStatus' });

@ObjectType({
  description:
    'Token for the Syncfy widget. The user types the bank login into the widget; Finnit never sees it.',
})
export class BankWidgetSession {
  @Field(() => BankProvider)
  provider: BankProvider;

  @Field({ description: 'Short-lived Syncfy session token; do not store it' })
  token: string;

  @Field()
  widgetScriptUrl: string;

  @Field()
  widgetStylesheetUrl: string;
}

@ObjectType()
export class LinkedBankAccount {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true, description: 'Finnit account it imports into' })
  accountId?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true, description: 'Last 4 digits' })
  mask?: string;

  @Field({ nullable: true })
  type?: string;

  @Field({ nullable: true })
  currency?: string;

  @Field(() => Float, { nullable: true })
  balance?: number;

  @Field(() => Float, { nullable: true })
  creditLimit?: number;

  @Field(() => Float, { nullable: true })
  availableCredit?: number;

  @Field({ nullable: true })
  balanceUpdatedAt?: Date;
}

@ObjectType()
export class BankConnection {
  @Field(() => ID)
  id: string;

  @Field(() => BankProvider)
  provider: BankProvider;

  @Field({ nullable: true })
  institution?: string;

  @Field(() => BankConnectionStatus)
  status: BankConnectionStatus;

  @Field(() => Int, { nullable: true })
  lastStatusCode?: number;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field({ nullable: true })
  lastSyncedAt?: Date;

  @Field(() => [LinkedBankAccount])
  accounts: LinkedBankAccount[];

  @Field()
  createdAt: Date;
}

@ObjectType()
export class BankSyncResult {
  @Field(() => BankConnection)
  connection: BankConnection;

  @Field(() => Int, { description: 'New movements imported' })
  imported: number;

  @Field(() => Int, { description: 'Transactions created from them' })
  created: number;

  @Field({
    description:
      'Whether Syncfy was asked to log in to the bank again (results arrive on the next sync)',
  })
  refreshRequested: boolean;
}

@InputType()
export class LinkBankAccountInput {
  @Field({
    nullable: true,
    description:
      'Existing Finnit account; omit with createAccount to create one',
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  createAccount?: boolean;
}
