import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DebtsService } from './debts.service';
import {
  Debt,
  CreateDebtInput,
  UpdateDebtInput,
  CreateDebtPaymentInput,
  DebtConnection,
  DebtsArgs,
  DebtSummary,
  DebtPayoffProjection,
  PayoffStrategyInput,
  DebtPayment,
} from './dto/debt.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Resolver(() => Debt)
@UseGuards(JwtAuthGuard)
export class DebtsResolver {
  constructor(private readonly debtsService: DebtsService) {}

  @Query(() => DebtConnection)
  async debts(
    @CurrentUser() user: any,
    @Args() args: DebtsArgs,
  ): Promise<DebtConnection> {
    return this.debtsService.findMany(user.id, args);
  }

  @Query(() => Debt)
  async debt(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<Debt> {
    return this.debtsService.findById(id, user.id);
  }

  @Query(() => DebtSummary)
  async debtSummary(@CurrentUser() user: any): Promise<DebtSummary> {
    return this.debtsService.getDebtSummary(user.id);
  }

  @Query(() => [DebtPayoffProjection])
  async payoffStrategy(
    @CurrentUser() user: any,
    @Args('input') input: PayoffStrategyInput,
  ): Promise<DebtPayoffProjection[]> {
    return this.debtsService.calculatePayoffStrategy(user.id, input);
  }

  @Mutation(() => Debt)
  async createDebt(
    @CurrentUser() user: any,
    @Args('input') input: CreateDebtInput,
  ): Promise<Debt> {
    return this.debtsService.create(user.id, input);
  }

  @Mutation(() => Debt)
  async updateDebt(
    @CurrentUser() user: any,
    @Args('id') id: string,
    @Args('input') input: UpdateDebtInput,
  ): Promise<Debt> {
    return this.debtsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteDebt(
    @CurrentUser() user: any,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.debtsService.delete(id, user.id);
  }

  @Mutation(() => DebtPayment)
  async createDebtPayment(
    @CurrentUser() user: any,
    @Args('input') input: CreateDebtPaymentInput,
  ): Promise<DebtPayment> {
    return this.debtsService.createPayment(user.id, input);
  }
}