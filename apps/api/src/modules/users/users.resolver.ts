import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { User, UpdateUserInput } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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
    @CurrentUser() currentUser: any,
    @Args('input') input: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(currentUser.id, input);
  }
}