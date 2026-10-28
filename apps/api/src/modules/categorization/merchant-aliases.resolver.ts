import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  AliasPreview,
  MerchantAlias,
  MerchantAliasInput,
} from './dto/merchant-alias.dto';
import { MerchantAliasesService } from './merchant-aliases.service';

@Resolver(() => MerchantAlias)
@UseGuards(JwtAuthGuard)
export class MerchantAliasesResolver {
  constructor(private readonly aliases: MerchantAliasesService) {}

  @Query(() => [MerchantAlias], {
    description: "The user's merchant aliases, highest priority first",
  })
  async merchantAliases(@CurrentUser() user: User): Promise<MerchantAlias[]> {
    return this.aliases.list(user.id);
  }

  @Query(() => AliasPreview, {
    description:
      'Movements a candidate alias would match (count and up to 20, newest first), without saving',
  })
  async previewMerchantAlias(
    @CurrentUser() user: User,
    @Args('input') input: MerchantAliasInput,
  ): Promise<AliasPreview> {
    return this.aliases.preview(user.id, input);
  }

  @Mutation(() => MerchantAlias, {
    description: 'Creates an alias and applies it to existing movements',
  })
  async createMerchantAlias(
    @CurrentUser() user: User,
    @Args('input') input: MerchantAliasInput,
  ): Promise<MerchantAlias> {
    return this.aliases.create(user.id, input);
  }

  @Mutation(() => MerchantAlias)
  async updateMerchantAlias(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: MerchantAliasInput,
  ): Promise<MerchantAlias> {
    return this.aliases.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  async deleteMerchantAlias(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.aliases.delete(user.id, id);
  }
}
