import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  AuthPayload,
  SignUpInput,
  SignInInput,
  RefreshTokenInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  TokenValidationResult,
  User,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async signUp(@Args('input') input: SignUpInput): Promise<AuthPayload> {
    return this.authService.signUp(input);
  }

  @Mutation(() => AuthPayload)
  async signIn(@Args('input') input: SignInInput): Promise<AuthPayload> {
    return this.authService.signIn(input);
  }

  @Mutation(() => AuthPayload)
  async refreshToken(@Args('input') input: RefreshTokenInput): Promise<AuthPayload> {
    return this.authService.refreshToken(input);
  }

  @Mutation(() => Boolean)
  async requestPasswordReset(
    @Args('input') input: RequestPasswordResetInput,
  ): Promise<boolean> {
    return this.authService.requestPasswordReset(input);
  }

  @Mutation(() => Boolean)
  async resetPassword(@Args('input') input: ResetPasswordInput): Promise<boolean> {
    return this.authService.resetPassword(input);
  }

  @Query(() => TokenValidationResult)
  async validateToken(@Args('token') token: string): Promise<TokenValidationResult> {
    return this.authService.validateToken(token);
  }

  @Query(() => User)
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: any): Promise<User> {
    return this.authService.getCurrentUser(user.id);
  }
}