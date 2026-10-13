import {
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { AiFeatureKey } from '@finnit/database';
import { AiModel } from './ai-model.dto';

registerEnumType(AiFeatureKey, {
  name: 'AiFeatureKey',
  valuesMap: {
    statement_parsing: {
      description: 'Read card statements (PDF) without a local parser',
    },
  },
});

@ObjectType({ description: 'Admin settings of one AI feature' })
export class AiFeature {
  @Field(() => AiFeatureKey)
  key: AiFeatureKey;

  @Field()
  enabled: boolean;

  @Field(() => AiModel, {
    nullable: true,
    description: "The feature's own model; null uses the catalog default",
  })
  aiModel?: AiModel;

  @Field({ description: 'If the model fails, try the other active models' })
  useFallbacks: boolean;

  @Field({
    description: 'Enabled and at least one model it may use is usable now',
  })
  usable: boolean;

  @Field({ nullable: true })
  updatedByName?: string;

  @Field()
  updatedAt: Date;
}

@InputType()
export class UpdateAiFeatureInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'An active model with PDF support; null goes back to the default',
  })
  @IsOptional()
  @IsUUID()
  aiModelId?: string | null;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  useFallbacks?: boolean;
}
