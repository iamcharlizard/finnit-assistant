import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionsArgs,
  SimilarTransactionsArgs,
} from './dto/transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  Transaction,
  TransactionConnection,
} from '../../common/types/models/transaction.model';

@Resolver(() => Transaction)
@UseGuards(JwtAuthGuard)
export class TransactionsResolver {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Query(() => TransactionConnection)
  async transactions(
    @CurrentUser() user: User,
    @Args() args: TransactionsArgs,
  ): Promise<TransactionConnection> {
    return this.transactionsService.findMany(user.id, args);
  }

  @Query(() => Transaction)
  async transaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findById(id, user.id);
  }

  @Query(() => [Transaction], {
    description:
      'Possible duplicates of a transaction about to be created: same account, amount within 0.01, within 3 days; newest first, at most 5',
  })
  async similarTransactions(
    @CurrentUser() user: User,
    @Args() args: SimilarTransactionsArgs,
  ): Promise<Transaction[]> {
    return this.transactionsService.findSimilar(user.id, args);
  }

  @Mutation(() => Transaction)
  async createTransaction(
    @CurrentUser() user: User,
    @Args('input') input: CreateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.create(user.id, input);
  }

  @Mutation(() => Transaction)
  async updateTransaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteTransaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.transactionsService.delete(id, user.id);
  }

  @Mutation(() => Boolean, {
    description:
      'Deletes the attachment and its file. Upload with POST /transactions/:id/attachments',
  })
  async removeTransactionAttachment(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.transactionsService.removeAttachment(id, user.id);
  }
}
