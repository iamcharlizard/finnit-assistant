import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AiModelsService } from './ai-models.service';
import { AiFeaturesService } from './ai-features.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiFeatureKey } from '@finnit/database';
import { AiFeature, UpdateAiFeatureInput } from './dto/ai-feature.dto';
import {
  AiModel,
  AiModelsArgs,
  CreateAiModelInput,
  UpdateAiModelInput,
} from './dto/ai-model.dto';

@Resolver(() => AiModel)
@UseGuards(JwtAuthGuard)
export class AiModelsResolver {
  constructor(
    private readonly catalog: AiModelsService,
    private readonly features: AiFeaturesService,
  ) {}

  @Query(() => [AiModel], {
    description: 'AI model catalog; default first, then by sortOrder',
  })
  async aiModels(@Args() args: AiModelsArgs): Promise<AiModel[]> {
    return this.catalog.list(args);
  }

  @Mutation(() => AiModel, { description: 'Admin only' })
  @UseGuards(AdminGuard)
  async createAiModel(
    @Args('input') input: CreateAiModelInput,
  ): Promise<AiModel> {
    return this.catalog.create(input);
  }

  @Mutation(() => AiModel, {
    description:
      'Admin only. Activate/deactivate, set as default, reorder. Deactivating the default unsets it.',
  })
  @UseGuards(AdminGuard)
  async updateAiModel(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAiModelInput,
  ): Promise<AiModel> {
    return this.catalog.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Admin only' })
  @UseGuards(AdminGuard)
  async deleteAiModel(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.catalog.delete(id);
  }

  @Query(() => [AiFeature], {
    description: 'Admin only. Settings of each AI feature',
  })
  @UseGuards(AdminGuard)
  async aiFeatures(): Promise<AiFeature[]> {
    return this.features.list();
  }

  @Mutation(() => AiFeature, {
    description:
      'Admin only. Turn an AI feature on/off, pick its model and fallbacks',
  })
  @UseGuards(AdminGuard)
  async updateAiFeature(
    @CurrentUser() actor: { id: string },
    @Args('key', { type: () => AiFeatureKey }) key: AiFeatureKey,
    @Args('input') input: UpdateAiFeatureInput,
  ): Promise<AiFeature> {
    return this.features.update(key, input, actor.id);
  }
}
