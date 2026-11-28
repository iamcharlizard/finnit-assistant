import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GlobalSettingsService } from './global-settings.service';
import {
  GlobalSettings,
  UpdateGlobalSettingsInput,
} from './dto/global-settings.dto';

@Resolver(() => GlobalSettings)
@UseGuards(JwtAuthGuard, AdminGuard)
export class GlobalSettingsResolver {
  constructor(private readonly settings: GlobalSettingsService) {}

  @Query(() => GlobalSettings, {
    description: 'Admin only. Platform-wide settings',
  })
  async globalSettings(): Promise<GlobalSettings> {
    return this.settings.get();
  }

  @Mutation(() => GlobalSettings, {
    description:
      'Admin only. Changes platform-wide settings (e.g. turns bank sync off for everyone)',
  })
  async updateGlobalSettings(
    @CurrentUser() actor: { id: string },
    @Args('input') input: UpdateGlobalSettingsInput,
  ): Promise<GlobalSettings> {
    return this.settings.update(input, actor.id);
  }
}
