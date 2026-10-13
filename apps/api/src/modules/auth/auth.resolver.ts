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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  User,
  toUserModel,
  type UserRecord,
} from '../../common/types/models/user.model';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async signIn(@Args('input') input: SignInInput): Promise<AuthPayload> {
    return this.authService.signIn(input);
  }

  @Mutation(() => AuthPayload, {
    description:
      'Signs in with a Google ID token. Only users an admin already added (same email) get in; it never creates accounts.',
  })
  async signInWithGoogle(
    @Args('input') input: SignInWithGoogleInput,
  ): Promise<AuthPayload> {
    return this.authService.signInWithGoogle(input);
  }

  @Mutation(() => AuthPayload)
  async refreshToken(
    @Args('input') input: RefreshTokenInput,
  ): Promise<AuthPayload> {
    return this.authService.refreshToken(input);
  }

  @Mutation(() => Boolean)
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
  ): Promise<boolean> {
    return this.authService.requestPasswordReset(input);
  }

  @Mutation(() => Boolean)
  async resetPassword(
    @Args('input') input: ResetPasswordInput,
  ): Promise<boolean> {
    return this.authService.resetPassword(input);
  }

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
