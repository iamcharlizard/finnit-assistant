import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ImportedLineStatus,
  ReceiptRoute,
  ReceiptStatus,
} from '@finnit/database';
import { Account } from '../../../common/types/models/account.model';

// The enums are registered for GraphQL by the statements and receipts DTOs.
import '../../statements/dto/statement.dto';
import '../../receipts/dto/receipt.dto';

export const MAX_SHOT_MERCHANT_LENGTH = 120;

@ObjectType({
  description: 'An existing movement a screenshot line looks like',
})
export class ScreenshotLineMatch {
  @Field(() => ID)
  id: string;

  @Field()
  date: Date;

  @Field(() => Float)
  amount: number;

  @Field({ nullable: true })
  name?: string;
}

@ObjectType({ description: 'A movement read from a screenshot' })
export class ScreenshotLine {
  @Field(() => ID)
  id: string;

  @Field()
  date: Date;

  @Field({ nullable: true })
  merchant?: string;

  @Field(() => Float, { description: '0 when it could not be read' })
  amount: number;

  @Field(() => String, {
    description: 'in: money into the account; out: a purchase',
  })
  direction: 'in' | 'out';

  @Field({ description: '"En proceso": shown by the bank, not applied yet' })
  inProcess: boolean;

  @Field(() => [String], {
    description: 'Fields to check: date, merchant, amount',
  })
  review: string[];

  @Field(() => ImportedLineStatus, {
    description:
      'pending: will be created; matched: already registered (not created); ignored: left out',
  })
  status: ImportedLineStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Suggested or chosen category',
  })
  categoryId?: string | null;

  @Field(() => ScreenshotLineMatch, { nullable: true })
  matchedTransaction?: ScreenshotLineMatch | null;
}

@ObjectType({ description: 'A screenshot of a bank app with movements' })
export class ScreenshotImport {
  @Field(() => ID)
  id: string;

  @Field(() => ReceiptStatus)
  status: ReceiptStatus;

  @Field(() => ReceiptRoute, { nullable: true })
  route?: ReceiptRoute | null;

  @Field(() => String, {
    nullable: true,
    description: '"Clásica Banamex **482"',
  })
  accountHint?: string | null;

  @Field(() => String, { nullable: true })
  last4?: string | null;

  @Field(() => Account, { nullable: true })
  account?: Account | null;

  @Field(() => [ScreenshotLine], {
    description: 'Empty until there is an account',
  })
  lines: ScreenshotLine[];

  @Field(() => Float, {
    description: 'Movements read (also before choosing the account)',
  })
  movementsRead: number;

  @Field(() => String, { nullable: true })
  errorMessage?: string | null;

  @Field()
  createdAt: Date;
}

@InputType()
export class UpdateScreenshotLineInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  date?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SHOT_MERCHANT_LENGTH)
  merchant?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  inProcess?: boolean;

  @Field(() => String, { nullable: true, description: '"" clears it' })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @Field({
    nullable: true,
    description:
      'false leaves it out; true creates it (even when it looks already registered)',
  })
  @IsOptional()
  @IsBoolean()
  include?: boolean;
}
