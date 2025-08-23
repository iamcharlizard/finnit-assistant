import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { 
  Account, 
  AccountConnection,
  CreateAccountInput, 
  UpdateAccountInput, 
  AdjustBalanceInput,
  AccountsArgs,
} from './dto/account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Account)
@UseGuards(JwtAuthGuard)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Query(() => AccountConnection)
  async accounts(
    @CurrentUser() user: any,
    @Args() args: AccountsArgs,
  ): Promise<AccountConnection> {
    return this.accountsService.findMany(user.id, args);
  }

  @Query(() => Account)
  async account(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Account> {
    return this.accountsService.findById(id, user.id);
  }

  @Mutation(() => Account)
  async createAccount(
    @CurrentUser() user: any,
    @Args('input') input: CreateAccountInput,
  ): Promise<Account> {
    return this.accountsService.create(user.id, input);
  }

  @Mutation(() => Account)
  async updateAccount(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('input') input: UpdateAccountInput,
  ): Promise<Account> {
    return this.accountsService.update(id, user.id, input);
  }

  @Mutation(() => Account)
  async adjustAccountBalance(
    @CurrentUser() user: any,
    @Args('input') input: AdjustBalanceInput,
  ): Promise<Account> {
    return this.accountsService.adjustBalance(user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteAccount(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.accountsService.delete(id, user.id);
  }
}