import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { Transfer } from '../../common/types/models/transfer.model';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { CreateTransferInput } from './dto/transfer.dto';

@Resolver(() => Transfer)
@UseGuards(JwtAuthGuard)
export class TransfersResolver {
  constructor(private readonly transfersService: TransfersService) {}

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
}
