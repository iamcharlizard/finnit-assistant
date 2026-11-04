import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  ScreenshotImport,
  UpdateScreenshotLineInput,
} from './dto/screenshot.dto';
import { ScreenshotsService } from './screenshots.service';

@Resolver(() => ScreenshotImport)
@UseGuards(JwtAuthGuard)
export class ScreenshotsResolver {
  constructor(private readonly screenshots: ScreenshotsService) {}

  @Query(() => ScreenshotImport, {
    description:
      'Poll it after uploading (POST /screenshots) to follow the status',
  })
  async screenshotImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ScreenshotImport> {
    return this.screenshots.findById(id, user.id);
  }

  @Mutation(() => ScreenshotImport, {
    description: 'The account the screenshot is about; its lines start over',
  })
  async setScreenshotAccount(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('accountId') accountId: string,
  ): Promise<ScreenshotImport> {
    return this.screenshots.setAccount(id, user.id, accountId);
  }

  @Mutation(() => ScreenshotImport)
  async updateScreenshotLine(
    @CurrentUser() user: User,
    @Args('lineId', { type: () => ID }) lineId: string,
    @Args('input') input: UpdateScreenshotLineInput,
  ): Promise<ScreenshotImport> {
    return this.screenshots.updateLine(lineId, user.id, input);
  }

  @Mutation(() => ScreenshotImport, {
    description:
      'Creates the included movements (the ones already registered are linked, not created)',
  })
  async confirmScreenshotImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ScreenshotImport> {
    return this.screenshots.confirm(id, user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Discards the screenshot and deletes the image',
  })
  async discardScreenshotImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.screenshots.discard(id, user.id);
  }
}
