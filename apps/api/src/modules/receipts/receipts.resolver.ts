import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import {
  ConfirmReceiptImportInput,
  ReceiptImport,
  ReceiptImportConnection,
  ReceiptImportsArgs,
  UpdateReceiptImportInput,
} from './dto/receipt.dto';
import { ReceiptsService } from './receipts.service';

@Resolver(() => ReceiptImport)
@UseGuards(JwtAuthGuard)
export class ReceiptsResolver {
  constructor(private readonly receipts: ReceiptsService) {}

  @Query(() => ReceiptImport, {
    description:
      'Poll it after uploading (POST /receipts) to follow the status',
  })
  async receiptImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ReceiptImport> {
    return this.receipts.findById(id, user.id);
  }

  @Query(() => ReceiptImportConnection, { description: 'Newest first' })
  async receiptImports(
    @CurrentUser() user: User,
    @Args() args: ReceiptImportsArgs,
  ): Promise<ReceiptImportConnection> {
    return this.receipts.findMany(user.id, args);
  }

  @Mutation(() => ReceiptImport)
  async updateReceiptImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateReceiptImportInput,
  ): Promise<ReceiptImport> {
    return this.receipts.update(id, user.id, input);
  }

  @Mutation(() => ReceiptImport, {
    description:
      'Creates the expense with the photo attached, or attaches the photo to `attachToTransactionId`',
  })
  async confirmReceiptImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ConfirmReceiptImportInput,
  ): Promise<ReceiptImport> {
    return this.receipts.confirm(id, user.id, input);
  }

  @Mutation(() => Boolean, {
    description: 'Discards the draft and deletes the photo',
  })
  async discardReceiptImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.receipts.discard(id, user.id);
  }
}
