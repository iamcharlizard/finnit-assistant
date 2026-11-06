import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum SimilarCategorySource {
  /** A learned merchant rule. */
  rule = 'rule',
  /** The category of the automatic name (alias rule) that names it. */
  automatic_name = 'automatic_name',
  /** The category the user gave the same merchant before. */
  history = 'history',
}

registerEnumType(SimilarCategorySource, {
  name: 'SimilarCategorySource',
  description:
    'Where a category suggested from the user’s own patterns comes from',
});

@ObjectType({
  description:
    "The category the user's own patterns suggest for a movement (rules, automatic names, past movements of the same merchant); never AI",
})
export class SimilarCategory {
  @Field(() => ID)
  categoryId: string;

  @Field(() => SimilarCategorySource)
  source: SimilarCategorySource;

  @Field(() => Int, {
    description:
      'Similar movements with that category (history only; 0 for rules and automatic names)',
  })
  count: number;
}

@ObjectType({
  description:
    "The AI's category for a movement being edited (not saved: the editor picks it)",
})
export class AiCategorySuggestion {
  @Field(() => ID, {
    nullable: true,
    description: 'Null when no category fits',
  })
  categoryId: string | null;

  @Field({ description: 'The AI is off or has no usable model' })
  aiUnavailable: boolean;
}
