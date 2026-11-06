import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@finnit/database';

registerEnumType(UserRole, { name: 'UserRole' });

export enum AvatarSource {
  /** A photo the user uploaded (served by GET /me/avatar). */
  uploaded = 'uploaded',
  /** Their Google account's picture. */
  google = 'google',
}

registerEnumType(AvatarSource, { name: 'AvatarSource' });

@ObjectType({
  description: 'Profile photo; without one, clients show initials',
})
export class UserAvatar {
  @Field(() => AvatarSource)
  source: AvatarSource;

  @Field(() => String, {
    nullable: true,
    description: 'Google only: the picture URL (an upload is GET /me/avatar)',
  })
  url: string | null;

  @Field({ description: 'Changes when the photo does (cache busting)' })
  version: string;
}

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

  @Field(() => UserAvatar, { nullable: true })
  avatar: UserAvatar | null;

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
  googlePictureUrl?: string | null;
  avatarKey?: string | null;
  avatarUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The uploaded photo wins over Google's; neither: no avatar. */
export function toUserAvatar(user: UserRecord): UserAvatar | null {
  if (user.avatarKey) {
    return {
      source: AvatarSource.uploaded,
      url: null,
      version: String((user.avatarUpdatedAt ?? user.updatedAt).getTime()),
    };
  }
  if (user.googlePictureUrl) {
    return {
      source: AvatarSource.google,
      url: user.googlePictureUrl,
      version: String((user.avatarUpdatedAt ?? user.updatedAt).getTime()),
    };
  }
  return null;
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
    avatar: toUserAvatar(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
