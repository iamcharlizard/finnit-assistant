import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AuthPayload,
  SignInInput,
  SignInWithGoogleInput,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  TokenValidationResult,
} from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GqlThrottlerGuard } from '../../common/throttling/gql-throttler.guard';
import { limits } from '../../common/throttling/throttling';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  User,
  toUserModel,
  type UserRecord,
} from '../../common/types/models/user.model';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(10, 10))
  @Mutation(() => AuthPayload)
  async signIn(@Args('input') input: SignInInput): Promise<AuthPayload> {
    return this.authService.signIn(input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(10, 20))
  @Mutation(() => AuthPayload, {
    description:
      'Signs in with a Google ID token. Only users an admin already added (same email) get in; it never creates accounts.',
  })
  async signInWithGoogle(
    @Args('input') input: SignInWithGoogleInput,
  ): Promise<AuthPayload> {
    return this.authService.signInWithGoogle(input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(30, 60))
  @Mutation(() => AuthPayload)
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<AuthPayload> {
    return this.authService.refreshToken(input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(5, 5))
  @Mutation(() => Boolean)
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
  ): Promise<boolean> {
    return this.authService.requestPasswordReset(input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(5, 10))
  @Mutation(() => Boolean)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<boolean> {
    return this.authService.resetPassword(input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle(limits(10, 30))
  @Query(() => TokenValidationResult)
  async validateToken(
    @Args('token') token: string,
  ): Promise<TokenValidationResult> {
    return this.authService.validateToken(token);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserRecord): User {
    return toUserModel(user);
  }
}
