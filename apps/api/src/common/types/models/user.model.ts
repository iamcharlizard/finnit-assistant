import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@finnit/database';

registerEnumType(UserRole, { name: 'UserRole' });

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field({ description: 'The master admin; cannot be demoted or disabled' })
  isMaster: boolean;

  @Field({ description: 'Can sign in with email and password' })
  hasPassword: boolean;

  @Field({ description: 'A Google account is linked' })
  hasGoogle: boolean;

  @Field({ description: "Preferred language: 'es' or 'en'" })
  locale: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

/** The fields of a database user needed to build the GraphQL `User`. */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isMaster: boolean;
  passwordHash: string | null;
  googleSubject: string | null;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Never exposes the password hash or the Google account id. */
export function toUserModel(user: UserRecord): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isMaster: user.isMaster,
    hasPassword: Boolean(user.passwordHash),
    hasGoogle: Boolean(user.googleSubject),
    locale: user.locale,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
