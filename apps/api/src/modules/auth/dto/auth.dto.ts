import { ObjectType, Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { User } from '../../../common/types/models/user.model';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => User)
  user: User;
}

@InputType()
export class SignInInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  password: string;
}

@InputType()
export class SignInWithGoogleInput {
  @Field({ description: 'ID token returned by Google Sign-In' })
  @IsString()
  @MaxLength(4096)
  idToken: string;

  @Field({
    nullable: true,
    description: 'Nonce sent to Google; when given it must match the token',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  nonce?: string;
}

@InputType()
export class RefreshTokenInput {
  @Field()
  @IsString()
  refreshToken: string;
}

@InputType()
export class RequestPasswordResetInput {
  @Field()
  @IsEmail()
  email: string;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsString()
  token: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}

@ObjectType()
export class TokenValidationResult {
  @Field()
  valid: boolean;

  @Field({ nullable: true })
  message?: string;
}
