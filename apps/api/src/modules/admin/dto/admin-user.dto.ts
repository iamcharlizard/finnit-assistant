import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole } from '@finnit/database';
import { PageInfo } from '../../../common/types/pagination.types';
import { MIN_PASSWORD_LENGTH } from '../../../common/utils/password.util';

export enum UserStatus {
  active = 'active',
  disabled = 'disabled',
}
registerEnumType(UserStatus, { name: 'UserStatus' });

@ObjectType({ description: 'A user as seen from the admin panel' })
export class AdminUser {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field()
  isMaster: boolean;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field({ description: 'Can sign in with email and password' })
  hasPassword: boolean;

  @Field({ description: 'A Google account is linked (signed in with it once)' })
  hasGoogle: boolean;

  @Field({ nullable: true })
  lastLoginAt?: Date;

  @Field({ nullable: true })
  disabledAt?: Date;

  @Field({ nullable: true, description: 'Name of the admin who added them' })
  invitedByName?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class AdminUserEdge {
  @Field(() => AdminUser)
  node: AdminUser;

  @Field()
  cursor: string;
}

@ObjectType()
export class AdminUserConnection {
  @Field(() => [AdminUserEdge])
  edges: AdminUserEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class AdminUsersArgs {
  @Field({ nullable: true, description: 'Matches name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field(() => UserStatus, { nullable: true })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @Field(() => UserRole, { nullable: true })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Field({
    description: 'They can also sign in with the Google account of this email',
  })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Field({
    nullable: true,
    description: 'Without a password they can only sign in with Google',
  })
  @IsOptional()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(128)
  password?: string;

  @Field(() => UserRole, {
    nullable: true,
    description: 'Only the master can create admins',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @Field(() => UserRole, {
    nullable: true,
    description: 'Only the master can change roles',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

@InputType()
export class SetUserPasswordInput {
  @Field()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(128)
  password: string;
}
