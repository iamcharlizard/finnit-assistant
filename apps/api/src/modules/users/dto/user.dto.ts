import { Field, InputType } from '@nestjs/graphql';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { APP_LOCALES, type AppLocale } from '../../translation/locale';

/** What a user may change on their own profile. The email is not here:
 * Google sign-in links accounts by email, so changing it is an admin task. */
@InputType()
export class UpdateMyProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;
}

@InputType()
export class UpdateMyPreferencesInput {
  @Field({ nullable: true, description: "Preferred language: 'es' or 'en'" })
  @IsOptional()
  @IsIn(APP_LOCALES)
  locale?: AppLocale;
}
