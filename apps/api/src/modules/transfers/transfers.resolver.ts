import { Resolver, Query, Mutation, Args, Float, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransferConversionService } from './transfer-conversion.service';
import { TransferSuggestionsService } from './transfer-suggestions.service';
import { DuplicatesService } from '../duplicates/duplicates.service';
import { Transfer } from '../../common/types/models/transfer.model';
import { Transaction } from '../../common/types/models/transaction.model';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { CreateTransferInput, TransferLegCandidates } from './dto/transfer.dto';
import {
  ConvertToTransferInput,
  ResolveTransferSuggestionInput,
  TransferSuggestionConnection,
  TransferSuggestionsArgs,
} from './dto/transfer-suggestion.dto';

@Resolver(() => Transfer)
@UseGuards(JwtAuthGuard)
export class TransfersResolver {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly conversion: TransferConversionService,
    private readonly suggestions: TransferSuggestionsService,
    private readonly duplicates: DuplicatesService,
  ) {}

  @Query(() => [Transfer])
  async transfers(@CurrentUser() user: User): Promise<any> {
    return this.transfersService.findMany(user.id);
  }

  @Query(() => Transfer)
  async transfer(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<any> {
    return this.transfersService.findById(id, user.id);
  }

  @Mutation(() => Transfer)
  async createTransfer(
    @CurrentUser() user: User,
    @Args('input') input: CreateTransferInput,
  ): Promise<any> {
    const transfer = await this.transfersService.create(user.id, input);
    // A side made by hand may be a movement the bank already brought.
    const made = [
      input.fromTransactionId ? null : transfer.fromTxnId,
      input.toTransactionId ? null : transfer.toTxnId,
    ].filter((id): id is string => Boolean(id));
    await this.duplicates.detect(user.id, made);
    return transfer;
  }

  @Query(() => TransferLegCandidates, {
    description:
      'Movements already recorded that may be the sides of a new transfer (same amount, a few days around the date)',
  })
  transferLegCandidates(
    @CurrentUser() user: User,
    @Args('fromAccountId', { type: () => ID }) fromAccountId: string,
    @Args('toAccountId', { type: () => ID }) toAccountId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('date', { nullable: true }) date?: Date,
  ): Promise<TransferLegCandidates> {
    return this.transfersService.legCandidates(user.id, {
      fromAccountId,
      toAccountId,
      amount,
      date,
    });
  }

  @Mutation(() => Boolean, {
    description:
      'Deletes a transfer: sides it created are deleted; sides that were expenses/income (or came from the bank) go back to being them',
  })
  deleteTransfer(
    @CurrentUser() user: User,
    @Args('transferId', { type: () => ID }) transferId: string,
  ): Promise<boolean> {
    return this.transfersService.delete(user.id, transferId);
  }

  @Query(() => [Transaction], {
    description:
      'Movements in other accounts that may be the other side of this expense/income, best first',
  })
  transferCandidates(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
    @Args('accountId', { type: () => ID, nullable: true })
    accountId?: string | null,
  ): Promise<Transaction[]> {
    return this.conversion.candidates(user.id, transactionId, accountId);
  }

  @Mutation(() => Transfer, {
    description:
      'Turns an expense/income into a transfer side, linking or creating the other side',
  })
  convertToTransfer(
    @CurrentUser() user: User,
    @Args('input') input: ConvertToTransferInput,
  ): Promise<Transfer> {
    return this.conversion.convert(user.id, input);
  }

  @Mutation(() => Boolean, {
    description: 'Gives the movements of a converted transfer their type back',
  })
  undoTransferConversion(
    @CurrentUser() user: User,
    @Args('transferId', { type: () => ID }) transferId: string,
  ): Promise<boolean> {
    return this.conversion.undo(user.id, transferId);
  }

  @Query(() => TransferSuggestionConnection, {
    description: 'Bank movements that look like transfers, waiting for review',
  })
  transferSuggestions(
    @CurrentUser() user: User,
    @Args() args: TransferSuggestionsArgs,
  ): Promise<TransferSuggestionConnection> {
    return this.suggestions.list(user.id, args);
  }

  @Mutation(() => Boolean)
  resolveTransferSuggestion(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ResolveTransferSuggestionInput,
  ): Promise<boolean> {
    return this.suggestions.resolve(user.id, id, input);
  }
}
