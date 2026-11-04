import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import {
  AccountConnection,
  CreateAccountInput,
  UpdateAccountInput,
  AdjustBalanceInput,
  SetAccountBalanceInput,
  AccountBalanceHistory,
  AccountBalanceHistoryArgs,
  AccountsBalanceHistory,
  AccountsBalanceHistoryArgs,
  AccountsArgs,
  CreditCardTermsInput,
} from './dto/account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { Account } from '../../common/types/models/account.model';

@Resolver(() => Account)
@UseGuards(JwtAuthGuard)
export class AccountsResolver {
  constructor(private readonly accountsService: AccountsService) {}

  @Query(() => AccountConnection)
  async accounts(
    @CurrentUser() user: User,
    @Args() args: AccountsArgs,
  ): Promise<AccountConnection> {
    return this.accountsService.findMany(user.id, args);
  }

  @Query(() => Account)
  async account(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Account> {
    return this.accountsService.findById(id, user.id);
  }

  @Query(() => AccountBalanceHistory, {
    description:
      "The account's opening and closing balance on each day of a range (up to 366 days, newest first)",
  })
  async accountBalanceHistory(
    @CurrentUser() user: User,
    @Args() args: AccountBalanceHistoryArgs,
  ): Promise<AccountBalanceHistory> {
    return this.accountsService.balanceHistory(user.id, args);
  }

  @Query(() => AccountsBalanceHistory, {
    description:
      'All the accounts together, day by day: money available and card debt (one currency, up to 366 days, newest first)',
  })
  async accountsBalanceHistory(
    @CurrentUser() user: User,
    @Args() args: AccountsBalanceHistoryArgs,
  ): Promise<AccountsBalanceHistory> {
    return this.accountsService.allBalanceHistory(user.id, args);
  }

  @Mutation(() => Account)
  async createAccount(
    @CurrentUser() user: User,
    @Args('input') input: CreateAccountInput,
  ): Promise<Account> {
    return this.accountsService.create(user.id, input);
  }

  @Mutation(() => Account)
  async updateAccount(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateAccountInput,
  ): Promise<Account> {
    return this.accountsService.update(id, user.id, input);
  }

  @Mutation(() => Account)
  async adjustAccountBalance(
    @CurrentUser() user: User,
    @Args('input') input: AdjustBalanceInput,
  ): Promise<Account> {
    return this.accountsService.adjustBalance(user.id, input);
  }

  @Mutation(() => Account, {
    description:
      "Sets the account's balance to the real one; the difference is an adjustment",
  })
  async setAccountBalance(
    @CurrentUser() user: User,
    @Args('input') input: SetAccountBalanceInput,
  ): Promise<Account> {
    return this.accountsService.setBalance(user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteAccount(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.accountsService.delete(id, user.id);
  }

  @Mutation(() => Account, {
    description: "Sets the billing terms of one of the user's credit accounts",
  })
  async setCreditCardTerms(
    @CurrentUser() user: User,
    @Args('accountId', { type: () => ID }) accountId: string,
    @Args('input') input: CreditCardTermsInput,
  ): Promise<Account> {
    return this.accountsService.setCreditCardTerms(accountId, user.id, input);
  }

  @Mutation(() => Account)
  async removeCreditCardTerms(
    @CurrentUser() user: User,
    @Args('accountId', { type: () => ID }) accountId: string,
  ): Promise<Account> {
    return this.accountsService.removeCreditCardTerms(accountId, user.id);
  }
}
