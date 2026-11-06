import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { CategoryKind } from '@finnit/database';

registerEnumType(CategoryKind, {
  name: 'CategoryKind',
  description: "Spending or income (subcategories share their parent's)",
});

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

  @Field({
    description:
      'Part of the global catalog: shared by every user, nobody edits it (users hide it)',
  })
  isDefault: boolean;

  @Field(() => CategoryKind)
  kind: CategoryKind;

  @Field(() => String, {
    nullable: true,
    description: "Icon key the clients know; null: the parent's, or by name",
  })
  icon?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Color key the clients know; null: the icon's",
  })
  color?: string | null;

  @Field({ nullable: true })
  userId?: string;

  @Field()
  createdAt: Date;

  /**
   * Names per locale when the query already loaded them (not a GraphQL
   * field). Without it, the `name` field resolver batches a lookup.
   */
  translations?: Partial<Record<string, string>>;

  /** Whether the current user hid it, when the query already knows (not a GraphQL field). */
  hidden?: boolean;
}
