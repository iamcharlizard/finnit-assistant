import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateMyPreferencesInput, UpdateUserInput } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => User)
@UseGuards(JwtAuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User)
  async user(@Args('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Mutation(() => User)
  async updateUser(
    @CurrentUser() currentUser: User,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(currentUser.id, input);
  }

  @Mutation(() => User, {
    description: "Saves the signed-in user's preferences (e.g. locale).",
  })
  async updateMyPreferences(
    @CurrentUser() currentUser: User,
    @Args('input') input: UpdateMyPreferencesInput,
  ): Promise<User> {
    return this.usersService.updatePreferences(currentUser.id, input);
  }
}
