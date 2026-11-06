import {
  ArgsType,
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageInfo } from '../../../common/types/pagination.types';
import { APP_LOCALES, type AppLocale } from '../../translation/locale';

@InputType()
export class JoinWaitlistInput {
  @Field()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Field({
    nullable: true,
    description: "Language the page was in: 'es' or 'en'",
  })
  @IsOptional()
  @IsIn(APP_LOCALES)
  locale?: AppLocale;

  @Field({ nullable: true, description: 'Campaign (utm_source or ref)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}

@ObjectType()
export class JoinWaitlistResult {
  @Field({
    description:
      'Always true for a valid email, also when it was already on the list (it never tells who signed up).',
  })
  ok: boolean;
}

@ObjectType()
export class WaitlistEntry {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  locale?: string;

  @Field({ nullable: true })
  source?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class WaitlistEntryEdge {
  @Field(() => WaitlistEntry)
  node: WaitlistEntry;

  @Field()
  cursor: string;
}

@ObjectType()
export class WaitlistEntryConnection {
  @Field(() => [WaitlistEntryEdge])
  edges: WaitlistEntryEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;

  @Field(() => Int)
  totalCount: number;
}

@ArgsType()
export class WaitlistEntriesArgs {
  @Field(() => Int, { nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;
}
