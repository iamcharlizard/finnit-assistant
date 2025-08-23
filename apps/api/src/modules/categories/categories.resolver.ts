import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category, CreateCategoryInput, UpdateCategoryInput, CategoryUsage, CategoryUsageArgs, SuggestCategoryInput } from './dto/category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Category)
@UseGuards(JwtAuthGuard)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Query(() => [Category])
  async categories(@CurrentUser() user: any): Promise<Category[]> {
    return this.categoriesService.findAll(user.id);
  }

  @Query(() => [Category])
  async rootCategories(@CurrentUser() user: any): Promise<Category[]> {
    return this.categoriesService.findRootCategories(user.id);
  }

  @Query(() => Category)
  async category(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Category> {
    return this.categoriesService.findById(id, user.id);
  }

  @Mutation(() => Category)
  async createCategory(
    @CurrentUser() user: any,
    @Args('input') input: CreateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.create(user.id, input);
  }

  @Mutation(() => Category)
  async updateCategory(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('input') input: UpdateCategoryInput,
  ): Promise<Category> {
    return this.categoriesService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteCategory(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.categoriesService.delete(id, user.id);
  }

  @Query(() => [CategoryUsage])
  async categoryUsage(
    @CurrentUser() user: any,
    @Args() args: CategoryUsageArgs,
  ): Promise<CategoryUsage[]> {
    return this.categoriesService.getCategoryUsage(user.id, args.dateFrom, args.dateTo);
  }

  @Query(() => Category, { nullable: true })
  async suggestCategoryForMerchant(
    @CurrentUser() user: any,
    @Args('input') input: SuggestCategoryInput,
  ): Promise<Category | null> {
    return this.categoriesService.suggestCategoryForMerchant(user.id, input.merchantName);
  }

  @Mutation(() => Boolean)
  async createDefaultCategories(@CurrentUser() user: any): Promise<boolean> {
    await this.categoriesService.createDefaultCategories(user.id);
    return true;
  }
}