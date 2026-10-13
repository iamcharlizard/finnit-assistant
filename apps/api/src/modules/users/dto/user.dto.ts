import { Field, InputType } from '@nestjs/graphql';
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { APP_LOCALES, type AppLocale } from '../../translation/locale';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail()
  email?: string;
}

@InputType()
export class UpdateMyPreferencesInput {
  @Field({ nullable: true, description: "Preferred language: 'es' or 'en'" })
  @IsOptional()
  @IsIn(APP_LOCALES)
  locale?: AppLocale;
}
