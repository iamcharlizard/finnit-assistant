import { ObjectType, Field, InputType } from '@nestjs/graphql';
import {
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** #RRGGBB */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export const NICKNAME_MAX_LENGTH = 40;

@ObjectType({ description: "The user's look for an account (card colors)" })
export class AccountDesign {
  @Field({ description: 'Hex color, #RRGGBB' })
  primaryColor: string;

  @Field({ nullable: true, description: 'Hex color, #RRGGBB' })
  secondaryColor?: string;
}

@InputType()
export class AccountDesignInput {
  @Field({ description: 'Hex color, #RRGGBB' })
  @Matches(HEX_COLOR)
  primaryColor: string;

  @Field({ nullable: true, description: 'Hex color, #RRGGBB' })
  @IsOptional()
  @Matches(HEX_COLOR)
  secondaryColor?: string;
}

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

  @Field({ nullable: true, description: "The user's name for the account" })
  nickname?: string;

  @Field(() => AccountDesign, { nullable: true })
  design?: AccountDesign;
}

/**
 * Fields to set on the account's metadata. Updates merge into the stored
 * metadata: omitted fields are kept, `null` removes a field.
 */
@InputType()
export class AccountMetadataInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  bank?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  color?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  last4?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  creditLimit?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  provider?: string;

  @Field({ nullable: true, description: '1 to 40 characters' })
  @IsOptional()
  @IsString()
  @Length(1, NICKNAME_MAX_LENGTH)
  nickname?: string;

  @Field(() => AccountDesignInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AccountDesignInput)
  design?: AccountDesignInput;
}
