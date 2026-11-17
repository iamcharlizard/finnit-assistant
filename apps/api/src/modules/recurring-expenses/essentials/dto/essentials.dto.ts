import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength } from 'class-validator';

@InputType({
  description: 'One answer of the "¿qué podrías recortar?" questionnaire',
})
export class EssentialAnswerInput {
  @Field()
  @IsString()
  @MaxLength(40)
  question: string;

  @Field()
  @IsString()
  @MaxLength(40)
  answer: string;
}

@ObjectType()
export class EssentialAnswer {
  @Field()
  question: string;

  @Field()
  answer: string;
}

@ObjectType({
  description:
    "The user's answers to the questionnaire the AI classifies recurring expenses with",
})
export class RecurringEssentialProfile {
  @Field(() => [EssentialAnswer])
  answers: EssentialAnswer[];

  @Field()
  updatedAt: Date;
}

@ObjectType({ description: 'How a classification run went' })
export class EssentialsClassification {
  @Field(() => Int, { description: 'Recurring expenses classified now' })
  classified: number;

  @Field({ description: 'No AI model answered: nothing was classified' })
  aiUnavailable: boolean;
}
