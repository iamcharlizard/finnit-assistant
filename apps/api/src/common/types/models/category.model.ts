import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field()
  id: string;

  @Field()
  name: string;

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
}
