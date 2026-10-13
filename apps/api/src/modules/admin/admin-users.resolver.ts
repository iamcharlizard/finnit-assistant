import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminUsersService, type Actor } from './admin-users.service';
import {
  AdminUser,
  AdminUserConnection,
  AdminUsersArgs,
  CreateUserInput,
  SetUserPasswordInput,
  UpdateUserInput,
} from './dto/admin-user.dto';

/** Admin panel: who has access to Finnit. Every operation is admin-only. */
@Resolver(() => AdminUser)
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersResolver {
  constructor(private readonly users: AdminUsersService) {}

  @Query(() => AdminUserConnection, { description: 'Admin only' })
  async adminUsers(@Args() args: AdminUsersArgs): Promise<AdminUserConnection> {
    return this.users.list(args);
  }

  @Mutation(() => AdminUser, {
    description:
      'Admin only. Gives a person access: they sign in with the password set here, or with Google using this email.',
  })
  async createUser(
    @CurrentUser() actor: Actor,
    @Args('input') input: CreateUserInput,
  ): Promise<AdminUser> {
    return this.users.create(actor, input);
  }

  @Mutation(() => AdminUser, { description: 'Admin only' })
  async updateUser(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateUserInput,
  ): Promise<AdminUser> {
    return this.users.update(actor, id, input);
  }

  @Mutation(() => AdminUser, {
    description: 'Admin only. Ends their open sessions.',
  })
  async setUserPassword(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: SetUserPasswordInput,
  ): Promise<AdminUser> {
    return this.users.setPassword(actor, id, input.password);
  }

  @Mutation(() => AdminUser, {
    description: 'Admin only. Only for users with Google linked.',
  })
  async removeUserPassword(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUser> {
    return this.users.removePassword(actor, id);
  }

  @Mutation(() => AdminUser, { description: 'Admin only' })
  async unlinkUserGoogle(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUser> {
    return this.users.unlinkGoogle(actor, id);
  }

  @Mutation(() => AdminUser, {
    description: 'Admin only. Blocks sign-in and ends their open sessions.',
  })
  async disableUser(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUser> {
    return this.users.disable(actor, id);
  }

  @Mutation(() => AdminUser, { description: 'Admin only' })
  async enableUser(
    @CurrentUser() actor: Actor,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AdminUser> {
    return this.users.enable(actor, id);
  }
}
