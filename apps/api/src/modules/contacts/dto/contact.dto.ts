import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength } from 'class-validator';

@ObjectType({
  description:
    'A person the user deals with (e.g. who lent them money). Only the name for now',
})
export class Contact {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  createdAt: Date;
}

@InputType()
export class CreateContactInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}
