import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { Transfer, CreateTransferInput } from './dto/transfer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Transfer)
@UseGuards(JwtAuthGuard)
export class TransfersResolver {
  constructor(private readonly transfersService: TransfersService) {}

  @Query(() => [Transfer])
  async transfers(@CurrentUser() user: any): Promise<Transfer[]> {
    return this.transfersService.findMany(user.id);
  }

  @Query(() => Transfer)
  async transfer(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Transfer> {
    return this.transfersService.findById(id, user.id);
  }

  @Mutation(() => Transfer)
  async createTransfer(
    @CurrentUser() user: any,
    @Args('input') input: CreateTransferInput,
  ): Promise<Transfer> {
    return this.transfersService.create(user.id, input);
  }
}