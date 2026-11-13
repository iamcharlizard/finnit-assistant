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
  TransactionFilters,
} from './dto/transaction.dto';
import { TransactionSpending } from './dto/transaction-spending.dto';
import { CancellationCheck } from './dto/cancellation-check.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  Transaction,
  TransactionConnection,
} from '../../common/types/models/transaction.model';
import { TransferDirectionLoader } from './transfer-direction.loader';
import { PrivacyService } from '../privacy/privacy.service';
import { DuplicatesService } from '../duplicates/duplicates.service';
import { TransactionAliasInput } from '../categorization/dto/merchant-alias.dto';
import {
  TransactionLoanPayment,
  TransactionRecurringPayment,
  TransferCounterpart,
} from './dto/transaction-links.dto';
import {
  PRIVATE_FALLBACK_NAME,
  PRIVATE_FALLBACK_NAMES,
} from './transaction.mapper';
import {
  AppLocale,
  RequestLocale,
  resolveLocale,
  type LocaleRequest,
} from '../translation/locale';

@Resolver(() => Transaction)
@UseGuards(JwtAuthGuard)
export class TransactionsResolver {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly transferDirections: TransferDirectionLoader,
    private readonly privacy: PrivacyService,
    private readonly duplicates: DuplicatesService,
  ) {}

  @ResolveField('displayName', () => String, {
    description:
      'Name to show: one-off alias, else the matching alias rule, else (private) "Private movement", else merchantName, else description',
  })
  displayName(
    @Parent() transaction: Transaction,
    @Context('req') req: LocaleRequest,
  ): string {
    if (
      transaction.isPrivate &&
      transaction.displayName === PRIVATE_FALLBACK_NAME
    ) {
      return (
        PRIVATE_FALLBACK_NAMES[resolveLocale(req)] ?? PRIVATE_FALLBACK_NAME
      );
    }
    return transaction.displayName;
  }

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

  @ResolveField('transferId', () => ID, {
    nullable: true,
    description:
      'For transfers: the transfer both sides share (batched; lists use it to group them)',
  })
  async transferId(
    @Parent() transaction: Transaction,
    @Context('req') req: object,
  ): Promise<string | null> {
    if (transaction.type !== 'transfer') return null;
    return (
      (await this.transferDirections.loadSide(req, transaction.id))
        ?.transferId ?? null
    );
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

  @ResolveField('loanPayment', () => TransactionLoanPayment, {
    nullable: true,
    description:
      'The loan payment this movement is (one query per movement; for the detail, not lists)',
  })
  async loanPayment(
    @Parent() transaction: Transaction,
  ): Promise<TransactionLoanPayment | null> {
    return this.transactionsService.findLoanPayment(
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

  @Query(() => TransactionSpending, {
    description:
      'Confirmed spending by category of the movements that pass these filters (the history chart)',
  })
  async transactionSpending(
    @CurrentUser() user: User,
    @RequestLocale() locale: AppLocale,
    @Args('filters', { type: () => TransactionFilters, nullable: true })
    filters?: TransactionFilters,
  ): Promise<TransactionSpending> {
    return this.transactionsService.spending(user.id, filters, locale);
  }

  @Query(() => Transaction, {
    description:
      'One movement; unlike lists, it includes the original text of private movements',
  })
  async transaction(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Context('req') req: object,
  ): Promise<Transaction> {
    return this.transactionsService.findById(
      id,
      user.id,
      await this.privacy.isUnlocked(req, user.id),
    );
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
    const created = await this.transactionsService.create(user.id, input);
    // The bank may already have it: suggest merging them.
    await this.duplicates.detect(user.id, [created.id]);
    return created;
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

  @Mutation(() => Transaction, {
    description:
      '"Marcar como cancelado": a credit card movement the bank cancelled stays in the history but stops counting (balance, card cycles, totals)',
  })
  cancelTransaction(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.cancel(id, user.id);
  }

  @Mutation(() => Transaction, {
    description: '"Reactivar": a cancelled movement counts again',
  })
  restoreTransaction(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Transaction> {
    return this.transactionsService.restore(id, user.id);
  }

  @Query(() => CancellationCheck, {
    description:
      "Before cancelling: whether the movement's confirmed statement lists it and shows its reversal",
  })
  cancellationCheck(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CancellationCheck> {
    return this.transactionsService.cancellationCheck(id, user.id);
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
