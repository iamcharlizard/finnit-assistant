import {
  Args,
  Context,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  AliasPatternSuggestion,
  AliasPreview,
  AliasSpending,
  MerchantAlias,
  MerchantAliasInput,
  SuggestAliasPatternInput,
} from './dto/merchant-alias.dto';
import { MerchantAliasesService } from './merchant-aliases.service';
import { AliasPatternService } from './alias-pattern.service';
import { PrivacyService } from '../privacy/privacy.service';

/** Per request and date range: every rule's spending (one query). */
const spendingByRequest = new WeakMap<
  object,
  Map<string, Promise<Map<string, AliasSpending>>>
>();

@Resolver(() => MerchantAlias)
@UseGuards(JwtAuthGuard)
export class MerchantAliasesResolver {
  constructor(
    private readonly aliases: MerchantAliasesService,
    private readonly patterns: AliasPatternService,
    private readonly privacy: PrivacyService,
  ) {}

  private unlocked(req: object, user: User): Promise<boolean> {
    return this.privacy.isUnlocked(req, user.id);
  }

  @Query(() => [MerchantAlias], {
    description: "The user's merchant aliases, highest priority first",
  })
  async merchantAliases(
    @CurrentUser() user: User,
    @Context('req') req: object,
  ): Promise<MerchantAlias[]> {
    return this.aliases.list(user.id, await this.unlocked(req, user));
  }

  @ResolveField('spending', () => AliasSpending, {
    description:
      'What the movements it names (no one-off name) add up to between two dates',
  })
  async spending(
    @Parent() alias: MerchantAlias,
    @CurrentUser() user: User,
    @Context('req') req: object,
    @Args('from') from: Date,
    @Args('to') to: Date,
  ): Promise<AliasSpending> {
    let byRange = spendingByRequest.get(req);
    if (!byRange) {
      byRange = new Map();
      spendingByRequest.set(req, byRange);
    }
    const key = `${new Date(from).toISOString()}|${new Date(to).toISOString()}`;
    let all = byRange.get(key);
    if (!all) {
      all = this.aliases.spending(user.id, new Date(from), new Date(to));
      byRange.set(key, all);
    }
    return (await all).get(alias.id) ?? { count: 0, total: 0, currency: 'MXN' };
  }

  @Query(() => AliasPreview, {
    description:
      'Movements a candidate alias would match (count and up to 20, newest first), without saving',
  })
  async previewMerchantAlias(
    @CurrentUser() user: User,
    @Args('input') input: MerchantAliasInput,
    @Args('aliasId', {
      type: () => ID,
      nullable: true,
      description: 'The rule being edited',
    })
    aliasId: string | null,
    @Context('req') req: object,
  ): Promise<AliasPreview> {
    return this.aliases.preview(
      user.id,
      input,
      aliasId,
      await this.unlocked(req, user),
    );
  }

  @Mutation(() => AliasPatternSuggestion, {
    description:
      "Proposes the pattern of an automatic name from some of the user's movements (AI, checked against them; else the words they share). Saves nothing",
  })
  async suggestAliasPattern(
    @CurrentUser() user: User,
    @Args('input') input: SuggestAliasPatternInput,
    @Context('req') req: object,
  ): Promise<AliasPatternSuggestion> {
    return this.patterns.suggest(
      user.id,
      input,
      await this.unlocked(req, user),
    );
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
    @Context('req') req: object,
  ): Promise<MerchantAlias> {
    return this.aliases.update(
      user.id,
      id,
      input,
      await this.unlocked(req, user),
    );
  }

  @Mutation(() => Boolean)
  async deleteMerchantAlias(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Context('req') req: object,
  ): Promise<boolean> {
    return this.aliases.delete(user.id, id, await this.unlocked(req, user));
  }
}
