import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Category } from '../../../common/types/models/category.model';

@ObjectType({
  description:
    'Learned merchant → category rule: new movements of the merchant get the category without AI',
})
export class MerchantRule {
  @Field(() => ID)
  id: string;

  @Field({ description: 'Normalized merchant, e.g. "OXXO GAS"' })
  pattern: string;

  @Field(() => Category)
  category: Category;

  @Field(() => Int, { description: 'Movements confirmed with this rule' })
  hits: number;

  @Field()
  updatedAt: Date;
}
