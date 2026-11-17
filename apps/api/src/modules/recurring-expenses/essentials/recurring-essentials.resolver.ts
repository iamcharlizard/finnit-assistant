import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../../common/types/models/user.model';
import {
  EssentialAnswerInput,
  EssentialsClassification,
  RecurringEssentialProfile,
} from './dto/essentials.dto';
import { RecurringEssentialsService } from './recurring-essentials.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class RecurringEssentialsResolver {
  constructor(private readonly essentials: RecurringEssentialsService) {}

  @Query(() => RecurringEssentialProfile, {
    nullable: true,
    description:
      'The answers to the "¿qué podrías recortar?" questionnaire; null until answered',
  })
  recurringEssentialProfile(
    @CurrentUser() user: User,
  ): Promise<RecurringEssentialProfile | null> {
    return this.essentials.profile(user.id);
  }

  @Mutation(() => EssentialsClassification, {
    description:
      'Saves the questionnaire and has the AI classify every active recurring expense with it',
  })
  saveRecurringEssentialProfile(
    @CurrentUser() user: User,
    @Args('answers', { type: () => [EssentialAnswerInput] })
    answers: EssentialAnswerInput[],
  ): Promise<EssentialsClassification> {
    return this.essentials.saveProfile(user.id, answers);
  }

  @Mutation(() => EssentialsClassification, {
    description:
      'Has the AI classify the active recurring expenses again (onlyMissing: the ones not analyzed yet)',
  })
  classifyRecurringEssentials(
    @CurrentUser() user: User,
    @Args('onlyMissing', { defaultValue: true }) onlyMissing: boolean,
  ): Promise<EssentialsClassification> {
    return this.essentials.classify(user.id, { onlyMissing });
  }
}
