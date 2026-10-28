import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryUsage,
  CategoryUsageArgs,
  SuggestCategoryInput,
} from './dto/category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { Category } from '../../common/types/models/category.model';
import {
  AppLocale,
  RequestLocale,
  resolveLocale,
  type LocaleRequest,
} from '../translation/locale';
import { CategoryI18nLoader } from './category-names';

@Resolver(() => Category)
@UseGuards(JwtAuthGuard)
export class CategoriesResolver {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly i18n: CategoryI18nLoader,
  ) {}

  // Field resolvers apply to every Category in the schema (also
  // Transaction.category), whichever module returned it.

  @ResolveField('name', () => String)
  async name(
    @Parent() category: Category,
    @Context('req') req: LocaleRequest,
  ): Promise<string> {
    const locale = resolveLocale(req);
    if (category.translations) {
      return category.translations[locale] ?? category.name;
    }
    const loaded = await this.i18n.load(req, category.id, locale);
    return loaded?.name ?? category.name;
  }

  @ResolveField('key', () => String, { nullable: true })
  async key(
    @Parent() category: Category,
    @Context('req') req: LocaleRequest,
  ): Promise<string | null> {
    if (category.key !== undefined) return category.key;
    const loaded = await this.i18n.load(req, category.id, resolveLocale(req));
    return loaded?.key ?? null;
  }

  @ResolveField('originalName', () => String)
  originalName(@Parent() category: Category): string {
    return category.originalName ?? category.name;
  }

  @Query(() => [Category])
  async categories(@CurrentUser() user: User): Promise<Category[]> {
    return this.categoriesService.findAll(user.id);
  }

  @Query(() => [Category])
  async rootCategories(@CurrentUser() user: User): Promise<Category[]> {
    return this.categoriesService.findRootCategories(user.id);
  }

  @Query(() => Category)
  async category(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Category> {
    return this.categoriesService.findById(id, user.id);
  }

  @Mutation(() => Category)
  async createCategory(
    @CurrentUser() user: User,
    @Args('input') input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.create(user.id, input);
  }

  @Mutation(() => Category)
  async updateCategory(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteCategory(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.categoriesService.delete(id, user.id);
  }

  @Query(() => [CategoryUsage])
  async categoryUsage(
    @CurrentUser() user: User,
    @Args() args: CategoryUsageArgs,
    @RequestLocale() locale: AppLocale,
  ): Promise<CategoryUsage[]> {
    return this.categoriesService.getCategoryUsage(
      user.id,
      args.dateFrom,
      args.dateTo,
      locale,
    );
  }

  @Query(() => Category, { nullable: true })
  async suggestCategoryForMerchant(
    @CurrentUser() user: User,
    @Args('input') input: SuggestCategoryInput,
  ): Promise<Category | null> {
    return this.categoriesService.suggestCategoryForMerchant(
      user.id,
      input.merchantName,
    );
  }

  @Mutation(() => Boolean)
  async createDefaultCategories(@CurrentUser() user: User): Promise<boolean> {
    await this.categoriesService.createDefaultCategories(user.id);
    return true;
  }
}
