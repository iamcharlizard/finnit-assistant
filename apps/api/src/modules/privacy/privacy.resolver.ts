import {
  Args,
  Context,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { PRIVACY_UNLOCK_HEADER } from './privacy-pin';
import { PrivacyService } from './privacy.service';

@ObjectType()
export class PrivacyStatus {
  @Field({ description: 'The user has a privacy PIN' })
  hasPin: boolean;

  @Field({
    description: `This request carries a valid unlock (${PRIVACY_UNLOCK_HEADER} header)`,
  })
  unlocked: boolean;
}

@ObjectType()
export class PrivacyUnlock {
  @Field({
    description: `Send it in the ${PRIVACY_UNLOCK_HEADER} header until it expires`,
  })
  token: string;

  @Field()
  expiresAt: Date;
}

@InputType()
export class SetPrivacyPinInput {
  @Field({ description: '4 to 8 digits' })
  @IsString()
  @MaxLength(8)
  pin: string;

  @Field(() => String, {
    nullable: true,
    description: 'Needed to change an existing PIN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currentPin?: string | null;
}

@Resolver()
@UseGuards(JwtAuthGuard)
export class PrivacyResolver {
  constructor(private readonly privacy: PrivacyService) {}

  @Query(() => PrivacyStatus)
  privacyStatus(
    @CurrentUser() user: User,
    @Context('req') req: object,
  ): Promise<PrivacyStatus> {
    return this.privacy.status(user.id, req);
  }

  @Mutation(() => Boolean, {
    description: 'Creates or changes the privacy PIN; ends every unlock',
  })
  setPrivacyPin(
    @CurrentUser() user: User,
    @Args('input') input: SetPrivacyPinInput,
  ): Promise<boolean> {
    return this.privacy.setPin(user.id, input.pin, input.currentPin);
  }

  @Mutation(() => PrivacyUnlock, {
    description:
      'Checks the privacy PIN; the token unlocks protected automatic names for a few minutes',
  })
  unlockPrivacy(
    @CurrentUser() user: User,
    @Args('pin') pin: string,
  ): Promise<PrivacyUnlock> {
    return this.privacy.unlock(user.id, pin);
  }

  @Mutation(() => Boolean, {
    description: 'Emails a link to choose a new privacy PIN',
  })
  requestPrivacyPinReset(@CurrentUser() user: User): Promise<boolean> {
    return this.privacy.requestReset(user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Sets a new privacy PIN with the emailed link',
  })
  resetPrivacyPin(
    @CurrentUser() user: User,
    @Args('token') token: string,
    @Args('pin') pin: string,
  ): Promise<boolean> {
    return this.privacy.resetPin(user.id, token, pin);
  }
}
