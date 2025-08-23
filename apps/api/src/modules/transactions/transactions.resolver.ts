import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  Transaction,
  TransactionConnection,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionsArgs,
  Attachment,
  CreateAttachmentInput,
} from './dto/transaction.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Transaction)
@UseGuards(JwtAuthGuard)
export class TransactionsResolver {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Query(() => TransactionConnection)
  async transactions(
    @CurrentUser() user: any,
    @Args() args: TransactionsArgs,
  ): Promise<TransactionConnection> {
    return this.transactionsService.findMany(user.id, args);
  }

  @Query(() => Transaction)
  async transaction(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Transaction> {
    return this.transactionsService.findById(id, user.id);
  }

  @Mutation(() => Transaction)
  async createTransaction(
    @CurrentUser() user: any,
    @Args('input') input: CreateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.create(user.id, input);
  }

  @Mutation(() => Transaction)
  async updateTransaction(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('input') input: UpdateTransactionInput,
  ): Promise<Transaction> {
    return this.transactionsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteTransaction(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.transactionsService.delete(id, user.id);
  }

  @Mutation(() => Attachment)
  async addTransactionAttachment(
    @CurrentUser() user: any,
    @Args('input') input: CreateAttachmentInput,
  ): Promise<Attachment> {
    return this.transactionsService.addAttachment(user.id, input);
  }

  @Mutation(() => Boolean)
  async removeTransactionAttachment(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.transactionsService.removeAttachment(id, user.id);
  }
}