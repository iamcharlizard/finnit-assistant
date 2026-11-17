import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '@finnit/database';
import {
  MAX_ALIAS_NAME_LENGTH,
  MAX_ALIAS_PATTERN_LENGTH,
} from '../../categorization/dto/merchant-alias.dto';
import { Transaction } from '../../../common/types/models/transaction.model';

@InputType({
  description:
    'Keep doing it: an automatic name for movements whose bank text contains `pattern`',
})
export class RememberDirectionInput {
  @Field({
    description: `Text the bank text contains (1–${MAX_ALIAS_PATTERN_LENGTH})`,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_ALIAS_PATTERN_LENGTH)
  pattern: string;

  @Field({
    description: `Name of the movements when a new automatic name is created (1–${MAX_ALIAS_NAME_LENGTH})`,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_ALIAS_NAME_LENGTH)
  displayName: string;
}

@InputType()
export class ChangeDirectionInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field(() => TransactionType, { description: 'income or expense' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @Field(() => RememberDirectionInput, {
    nullable: true,
    description:
      'Also record matching movements (the ones already there and the next ones) this way',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RememberDirectionInput)
  remember?: RememberDirectionInput | null;
}

@ObjectType({ description: 'A movement recorded as income or as expense' })
export class ChangeDirectionResult {
  @Field(() => Transaction)
  transaction: Transaction;

  @Field(() => Int, {
    description: 'Other movements of the automatic name turned the same way',
  })
  alsoChanged: number;
}
