import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field()
  id: string;

  @Field({
    description:
      "Name in the request's locale (x-locale header, else the user's locale)",
  })
  name: string;

  @Field(() => String, {
    nullable: true,
    description:
      'i18n key of a default category (e.g. categories.food.groceries)',
  })
  key?: string | null;

  @Field({ description: 'Original (English) name' })
  originalName?: string;

  @Field({ nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  parent?: Category;

  @Field(() => [Category], { nullable: true })
  children?: Category[];

  @Field({ nullable: true })
  sortOrder?: number;

  @Field()
  isDefault: boolean;

  @Field({ nullable: true })
  userId?: string;

  @Field()
  createdAt: Date;

  /**
   * Names per locale when the query already loaded them (not a GraphQL
   * field). Without it, the `name` field resolver batches a lookup.
   */
  translations?: Partial<Record<string, string>>;
}
