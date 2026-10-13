import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AiProvider } from '@finnit/database';

registerEnumType(AiProvider, { name: 'AiProvider' });

@ObjectType()
export class AiModel {
  @Field(() => ID)
  id: string;

  @Field(() => AiProvider)
  provider: AiProvider;

  @Field({ description: 'Provider model name, e.g. "claude-haiku-5-5"' })
  modelId: string;

  @Field()
  label: string;

  @Field()
  isActive: boolean;

  @Field({ description: 'Tried first; the rest follow sortOrder' })
  isDefault: boolean;

  @Field()
  supportsPdf: boolean;

  @Field(() => Int)
  sortOrder: number;

  @Field({ description: "Whether the provider's API key is set on the server" })
  providerConfigured: boolean;

  @Field({ description: 'Active and its provider is configured' })
  usable: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ArgsType()
export class AiModelsArgs {
  @Field({ nullable: true, description: 'Only active models' })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;

  @Field(() => AiProvider, { nullable: true })
  @IsOptional()
  @IsEnum(AiProvider)
  provider?: AiProvider;
}

@InputType()
export class CreateAiModelInput {
  @Field(() => AiProvider)
  @IsEnum(AiProvider)
  provider: AiProvider;

  @Field()
  @IsString()
  modelId: string;

  @Field()
  @IsString()
  label: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  @IsBoolean()
  supportsPdf?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

@InputType()
export class UpdateAiModelInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  supportsPdf?: boolean;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
