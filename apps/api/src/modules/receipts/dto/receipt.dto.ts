import {
  ArgsType,
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ReceiptConfidence,
  ReceiptRoute,
  ReceiptStatus,
} from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';
import { Account } from '../../../common/types/models/account.model';
import { Category } from '../../../common/types/models/category.model';
import { Transaction } from '../../../common/types/models/transaction.model';

registerEnumType(ReceiptStatus, {
  name: 'ReceiptStatus',
  description:
    'uploaded → processing → needs_review (draft waiting for the user) → confirmed | discarded; failed when the photo could not be read (it can still be filled in by hand and confirmed).',
});
registerEnumType(ReceiptRoute, {
  name: 'ReceiptRoute',
  description:
    'cfdi_qr: SAT QR of a printed CFDI (exact total and tax ID). ocr_rules: OCR text + local rules. ai: OCR text sent to the AI fallback.',
});
registerEnumType(ReceiptConfidence, {
  name: 'ReceiptConfidence',
  description:
    'high: total and date, cross-checked (QR or subtotal + tax). medium: total and date. low: something is missing.',
});

export const MAX_MERCHANT_NAME_LENGTH = 120;
export const MAX_RECEIPT_DESCRIPTION_LENGTH = 255;

@ObjectType({
  description:
    'A receipt photo and the fields extracted from it. The photo is at GET /receipts/:id/file (owner only).',
})
export class ReceiptImport {
  @Field(() => ID)
  id: string;

  @Field(() => ReceiptStatus)
  status: ReceiptStatus;

  @Field(() => String, { nullable: true })
  fileName?: string | null;

  @Field(() => ReceiptRoute, { nullable: true })
  route?: ReceiptRoute | null;

  @Field(() => ReceiptConfidence, { nullable: true })
  confidence?: ReceiptConfidence | null;

  @Field(() => Float, { nullable: true })
  total?: number | null;

  @Field()
  currency: string;

  @Field(() => Date, {
    nullable: true,
    description: 'Purchase day (date-only)',
  })
  date?: Date | null;

  @Field(() => String, { nullable: true })
  merchantName?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Merchant's tax ID (RFC)",
  })
  merchantTaxId?: string | null;

  @Field(() => String, { nullable: true })
  cardLast4?: string | null;

  @Field(() => Account, {
    nullable: true,
    description: 'Account whose last 4 digits appear on the receipt',
  })
  suggestedAccount?: Account | null;

  @Field(() => Category, { nullable: true })
  suggestedCategory?: Category | null;

  @Field(() => Transaction, {
    nullable: true,
    description:
      'Existing movement with the same amount (±0.01) within 3 days (same account when one is suggested): offer to attach the photo to it instead of creating a duplicate',
  })
  matchedTransaction?: Transaction | null;

  @Field(() => Transaction, {
    nullable: true,
    description: 'The movement created or attached to on confirm',
  })
  transaction?: Transaction | null;

  @Field(() => String, { nullable: true })
  errorMessage?: string | null;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class ReceiptImportEdge {
  @Field(() => ReceiptImport)
  node: ReceiptImport;

  @Field()
  cursor: string;
}

@ObjectType()
export class ReceiptImportConnection {
  @Field(() => [ReceiptImportEdge])
  edges: ReceiptImportEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class ReceiptImportsArgs {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}

@InputType({ description: 'Corrections while reviewing; null clears a field' })
export class UpdateReceiptImportInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  total?: number | null;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  date?: Date | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MERCHANT_NAME_LENGTH)
  merchantName?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}

@InputType()
export class ConfirmReceiptImportInput {
  @Field(() => ID)
  @IsUUID()
  accountId: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Without it, the merchant rules / learned tax IDs pick the category',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Field(() => Float)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  total: number;

  @Field(() => Date)
  @IsDate()
  date: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MERCHANT_NAME_LENGTH)
  merchantName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_RECEIPT_DESCRIPTION_LENGTH)
  description?: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Attach the photo to this existing movement instead of creating a new one',
  })
  @IsOptional()
  @IsUUID()
  attachToTransactionId?: string;
}
