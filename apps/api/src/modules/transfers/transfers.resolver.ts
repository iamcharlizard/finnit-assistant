import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransferConversionService } from './transfer-conversion.service';
import { TransferSuggestionsService } from './transfer-suggestions.service';
import { Transfer } from '../../common/types/models/transfer.model';
import { Transaction } from '../../common/types/models/transaction.model';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { CreateTransferInput } from './dto/transfer.dto';
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
    return this.transfersService.create(user.id, input);
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
