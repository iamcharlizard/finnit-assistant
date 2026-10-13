import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AiModelsService } from './ai-models.service';
import {
  AiModel,
  AiModelsArgs,
  CreateAiModelInput,
  UpdateAiModelInput,
} from './dto/ai-model.dto';

@Resolver(() => AiModel)
@UseGuards(JwtAuthGuard)
export class AiModelsResolver {
  constructor(private readonly catalog: AiModelsService) {}

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
}
