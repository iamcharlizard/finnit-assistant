import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  Context,
  ID,
} from '@nestjs/graphql';
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
import { TransferDirectionLoader } from './transfer-direction.loader';
import { TransactionAliasInput } from '../categorization/dto/merchant-alias.dto';
import {
  TransactionRecurringPayment,
  TransferCounterpart,
} from './dto/transaction-links.dto';

@Resolver(() => Transaction)
@UseGuards(JwtAuthGuard)
export class TransactionsResolver {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transferDirections: TransferDirectionLoader,
  ) {}

  @ResolveField('transferDirection', () => String, {
    nullable: true,
    description:
      'For transfers: "out" on the source account, "in" on the destination; null otherwise',
  })
  async transferDirection(
    @Parent() transaction: Transaction,
    @Context('req') req: object,
  ): Promise<string | null> {
    if (transaction.type !== 'transfer') return null;
    return this.transferDirections.load(req, transaction.id);
  }

  @ResolveField('transferCounterpart', () => TransferCounterpart, {
    nullable: true,
    description:
      'For transfers: the other side (one query per movement; for the detail, not lists)',
  })
  async transferCounterpart(
    @Parent() transaction: Transaction,
  ): Promise<TransferCounterpart | null> {
    if (transaction.type !== 'transfer') return null;
    return this.transactionsService.findTransferCounterpart(
      transaction.id,
      transaction.userId,
    );
  }

  @ResolveField('recurringPayment', () => TransactionRecurringPayment, {
    nullable: true,
    description:
      'The recurring payment this movement paid (one query per movement; for the detail, not lists)',
  })
  async recurringPayment(
    @Parent() transaction: Transaction,
  ): Promise<TransactionRecurringPayment | null> {
    return this.transactionsService.findRecurringPayment(
      transaction.id,
      transaction.userId,
    );
  }

  @Query(() => TransactionConnection)
  async transactions(
    @CurrentUser() user: User,
    @Args() args: TransactionsArgs,
  ): Promise<TransactionConnection> {
    return this.transactionsService.findMany(user.id, args);
  }

  @Query(() => Transaction, {
    description:
      'One movement; unlike lists, it includes the original text of private movements',
  })
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

  @Mutation(() => Transaction, {
    description:
      'One-off display name and/or privacy for one movement (no alias rule). displayName null or "" clears it',
  })
  async setTransactionAlias(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: TransactionAliasInput,
  ): Promise<Transaction> {
    return this.transactionsService.setAlias(id, user.id, input);
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
