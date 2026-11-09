import { InputType, Field, ID, ObjectType } from '@nestjs/graphql';
import { Transaction } from '../../../common/types/models/transaction.model';
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';

@InputType()
export class CreateTransferInput {
  @Field()
  @IsString()
  fromAccountId: string;

  @Field()
  @IsString()
  toAccountId: string;

  @Field()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  txnDate?: Date;

  @Field(() => ID, {
    nullable: true,
    description:
      'A movement already recorded in the source account that becomes the outgoing side (none is created)',
  })
  @IsOptional()
  @IsString()
  fromTransactionId?: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'A movement already recorded in the destination account that becomes the incoming side (none is created)',
  })
  @IsOptional()
  @IsString()
  toTransactionId?: string;
}

@ObjectType({
  description:
    'Movements already recorded that may be the sides of a new transfer, best first',
})
export class TransferLegCandidates {
  @Field(() => [Transaction], { description: 'Money leaving the source' })
  from: Transaction[];

  @Field(() => [Transaction], {
    description: 'Money arriving at the destination',
  })
  to: Transaction[];
}
