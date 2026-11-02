import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
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
  AddDebtChargeInput,
  UpdateLoanInput,
  RecordDebtPaymentInput,
  AcceptSuggestionAsLoanInput,
  LoanPaymentCandidate,
  LoanScheduleItem,
  DebtInsights,
  DebtInsightsArgs,
} from './dto/debt.dto';
import { LoansService } from './loans.service';
import { LoanTrackingService } from './loan-tracking.service';
import { DebtInsightsService } from './debt-insights.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';

@Resolver(() => Debt)
@UseGuards(JwtAuthGuard)
export class DebtsResolver {
  constructor(
    private readonly debtsService: DebtsService,
    private readonly loans: LoansService,
    private readonly tracking: LoanTrackingService,
    private readonly insightsService: DebtInsightsService,
  ) {}

  @Query(() => DebtInsights, {
    description:
      'Debt by type, payments per month (historical apart), projected balance and what is due soon',
  })
  async debtInsights(
    @CurrentUser() user: User,
    @Args() args: DebtInsightsArgs,
  ): Promise<DebtInsights> {
    return this.insightsService.insights(user.id, args);
  }

  @Query(() => [LoanScheduleItem], {
    description:
      'Every payment of a loan by date: paid (historical included), open and projected until it is paid off',
  })
  async loanSchedule(
    @CurrentUser() user: User,
    @Args('debtId', { type: () => ID }) debtId: string,
  ): Promise<LoanScheduleItem[]> {
    return this.tracking.schedule(user.id, debtId);
  }

  @Query(() => [LoanPaymentCandidate], {
    description:
      'Bank movements that look like open payments of a loan; confirm them with confirmLoanPayment',
  })
  async loanPaymentCandidates(
    @CurrentUser() user: User,
    @Args('debtId', { type: () => ID }) debtId: string,
  ): Promise<LoanPaymentCandidate[]> {
    return this.tracking.paymentCandidates(user.id, debtId);
  }

  @Mutation(() => Debt, {
    description:
      'Links a movement to an open payment of a loan; its merchant becomes the loan pattern for later syncs',
  })
  async confirmLoanPayment(
    @CurrentUser() user: User,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<Debt> {
    return this.tracking.confirmPayment(user.id, occurrenceId, transactionId);
  }

  @Query(() => DebtConnection)
  async debts(
    @CurrentUser() user: User,
    @Args() args: DebtsArgs,
  ): Promise<DebtConnection> {
    return this.debtsService.findMany(user.id, args);
  }

  @Query(() => Debt)
  async debt(@CurrentUser() user: User, @Args('id') id: string): Promise<Debt> {
    return this.debtsService.findById(id, user.id);
  }

  @Query(() => DebtSummary)
  async debtSummary(@CurrentUser() user: User): Promise<DebtSummary> {
    return this.debtsService.getDebtSummary(user.id);
  }

  @Query(() => [DebtPayoffProjection])
  async payoffStrategy(
    @CurrentUser() user: User,
    @Args('input') input: PayoffStrategyInput,
  ): Promise<DebtPayoffProjection[]> {
    return this.debtsService.calculatePayoffStrategy(user.id, input);
  }

  @Mutation(() => Debt, {
    description:
      'Creates a debt; with a loanType, a loan with its terms, payment schedule and payments already made',
  })
  async createDebt(
    @CurrentUser() user: User,
    @Args('input') input: CreateDebtInput,
  ): Promise<Debt> {
    return input.loanType
      ? this.loans.create(user.id, input)
      : this.debtsService.create(user.id, input);
  }

  @Mutation(() => Debt, {
    description:
      'Turns a recurring suggestion into a loan: its detected charges become paid installments',
  })
  async acceptRecurringSuggestionAsLoan(
    @CurrentUser() user: User,
    @Args('fingerprint', { type: () => ID }) fingerprint: string,
    @Args('input') input: AcceptSuggestionAsLoanInput,
  ): Promise<Debt> {
    return this.loans.acceptSuggestion(user.id, fingerprint, input);
  }

  @Mutation(() => Debt, {
    description:
      'Edits a loan: name, lender, amount, number of payments, date, fees and purpose; recomputes its terms and open payments',
  })
  async updateLoan(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateLoanInput,
  ): Promise<Debt> {
    return this.loans.update(user.id, id, input);
  }

  @Mutation(() => Debt, {
    description:
      'Adds money to a loan: another personal loan or a financed purchase',
  })
  async addDebtCharge(
    @CurrentUser() user: User,
    @Args('input') input: AddDebtChargeInput,
  ): Promise<Debt> {
    return this.loans.addCharge(user.id, input);
  }

  @Mutation(() => Debt)
  async deleteDebtCharge(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Debt> {
    return this.loans.deleteCharge(user.id, id);
  }

  @Mutation(() => Debt, {
    description:
      'Pays a debt from an account: creates the expense movement and links it',
  })
  async recordDebtPayment(
    @CurrentUser() user: User,
    @Args('input') input: RecordDebtPaymentInput,
  ): Promise<Debt> {
    return this.loans.recordPayment(user.id, input);
  }

  @Mutation(() => Boolean, {
    description: 'Deletes a historical payment (one without a movement)',
  })
  async deleteHistoricalDebtPayment(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.debtsService.deleteHistoricalPayment(id, user.id);
  }

  @Mutation(() => Debt)
  async updateDebt(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('input') input: UpdateDebtInput,
  ): Promise<Debt> {
    return this.debtsService.update(id, user.id, input);
  }

  @Mutation(() => Boolean)
  async deleteDebt(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.debtsService.delete(id, user.id);
  }

  @Mutation(() => DebtPayment)
  async createDebtPayment(
    @CurrentUser() user: User,
    @Args('input') input: CreateDebtPaymentInput,
  ): Promise<DebtPayment> {
    return this.debtsService.createPayment(user.id, input);
  }
}
