import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

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
export class SignUpInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
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