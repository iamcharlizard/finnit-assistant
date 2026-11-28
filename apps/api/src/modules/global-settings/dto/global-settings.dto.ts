import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsOptional } from 'class-validator';

@ObjectType({
  description:
    'Admin only. Settings for the whole platform ("Configuración global")',
})
export class GlobalSettings {
  @Field({
    description:
      'Bank syncs (scheduled and manual) and new bank connections are allowed',
  })
  bankSyncEnabled: boolean;

  @Field({ nullable: true })
  updatedByName?: string;

  @Field({ nullable: true })
  updatedAt?: Date;
}

@InputType()
export class UpdateGlobalSettingsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  bankSyncEnabled?: boolean;
}
