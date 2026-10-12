import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import {
  CreateRecurringExpenseInput,
  RecurringExpense,
  RecurringExpenseConnection,
  RecurringExpensesArgs,
  RecurringExpensesSummary,
  RecurringOccurrence,
  UpcomingPayment,
  UpcomingPaymentsArgs,
  UpdateRecurringExpenseInput,
} from './dto/recurring-expense.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => RecurringExpense)
@UseGuards(JwtAuthGuard)
export class RecurringExpensesResolver {
  constructor(private readonly service: RecurringExpensesService) {}

  @Query(() => RecurringExpenseConnection)
  async recurringExpenses(
    @CurrentUser() user: User,
    @Args() args: RecurringExpensesArgs,
  ): Promise<RecurringExpenseConnection> {
    return this.service.findMany(user.id, args);
  }

  @Query(() => RecurringExpense)
  async recurringExpense(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RecurringExpense> {
    return this.service.findById(id, user.id);
  }

  @Query(() => [RecurringOccurrence])
  async recurringExpenseOccurrences(
    @CurrentUser() user: User,
    @Args('recurringExpenseId', { type: () => ID }) recurringExpenseId: string,
    @Args('from', { nullable: true }) from?: Date,
    @Args('to', { nullable: true }) to?: Date,
  ): Promise<RecurringOccurrence[]> {
    return this.service.occurrences(recurringExpenseId, user.id, from, to);
  }

  @Query(() => [UpcomingPayment])
  async upcomingPayments(
    @CurrentUser() user: User,
    @Args() args: UpcomingPaymentsArgs,
  ): Promise<UpcomingPayment[]> {
    return this.service.upcomingPayments(user.id, args);
  }

  @Query(() => RecurringExpensesSummary)
  async recurringExpensesSummary(
    @CurrentUser() user: User,
  ): Promise<RecurringExpensesSummary> {
    return this.service.summary(user.id);
  }

  @Mutation(() => RecurringExpense)
  async createRecurringExpense(
    @CurrentUser() user: User,
    @Args('input') input: CreateRecurringExpenseInput,
  ): Promise<RecurringExpense> {
    return this.service.create(user.id, input);
  }

  @Mutation(() => RecurringExpense)
  async updateRecurringExpense(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRecurringExpenseInput,
  ): Promise<RecurringExpense> {
    return this.service.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteRecurringExpense(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.service.delete(id, user.id);
  }

  @Mutation(() => RecurringOccurrence, {
    description: 'Marks a manual (or unmatched automatic) payment as paid',
  })
  async markRecurringPaymentPaid(
    @CurrentUser() user: User,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
    @Args('transactionId', { type: () => ID, nullable: true })
    transactionId?: string,
  ): Promise<RecurringOccurrence> {
    return this.service.markOccurrencePaid(
      occurrenceId,
      user.id,
      transactionId,
    );
  }

  @Mutation(() => RecurringOccurrence)
  async skipRecurringPayment(
    @CurrentUser() user: User,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
  ): Promise<RecurringOccurrence> {
    return this.service.skipOccurrence(occurrenceId, user.id);
  }

  @Mutation(() => RecurringOccurrence, {
    description: 'Undoes paid/skipped/missed and unlinks the transaction',
  })
  async reopenRecurringPayment(
    @CurrentUser() user: User,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
  ): Promise<RecurringOccurrence> {
    return this.service.reopenOccurrence(occurrenceId, user.id);
  }
}
