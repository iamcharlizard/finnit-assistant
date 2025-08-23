import { ObjectType, Field } from '@nestjs/graphql';
import { User } from './user.model';

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => User)
  user: User;
}

@ObjectType()
export class TokenValidationResult {
  @Field()
  valid: boolean;

  @Field({ nullable: true })
  message?: string;
}
