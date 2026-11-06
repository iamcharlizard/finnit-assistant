import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { Debt } from './dto/debt.dto';
import {
  LoanExpenseCandidate,
  LoanExpenseCandidatesArgs,
  LoanLinkOptions,
  UnlinkLoanPaymentArgs,
} from './dto/loan-link.dto';
import { LoanLinksService } from './loan-links.service';

@Resolver()
@UseGuards(JwtAuthGuard)
export class LoanLinksResolver {
  constructor(private readonly links: LoanLinksService) {}

  @Query(() => LoanLinkOptions, {
    description:
      'Loans and payments an expense movement can pay; the payment due the same day is suggested',
  })
  async loanLinkOptions(
    @CurrentUser() user: User,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<LoanLinkOptions> {
    return this.links.linkOptions(user.id, transactionId);
  }

  @Query(() => [LoanExpenseCandidate], {
    description:
      'Expense movements that could be this loan payment: close in amount and date, those naming the loan first',
  })
  async loanExpenseCandidates(
    @CurrentUser() user: User,
    @Args() args: LoanExpenseCandidatesArgs,
  ): Promise<LoanExpenseCandidate[]> {
    return this.links.expenseCandidates(
      user.id,
      args.occurrenceId,
      args.search,
    );
  }

  @Mutation(() => Debt, {
    description:
      'Links an expense movement to a loan payment (open, or paid without a movement)',
  })
  async linkLoanPayment(
    @CurrentUser() user: User,
    @Args('occurrenceId', { type: () => ID }) occurrenceId: string,
    @Args('transactionId', { type: () => ID }) transactionId: string,
  ): Promise<Debt> {
    return this.links.link(user.id, occurrenceId, transactionId);
  }

  @Mutation(() => Debt, {
    description:
      'Takes the movement off a loan payment; the payment reopens or stays paid without a movement',
  })
  async unlinkLoanPayment(
    @CurrentUser() user: User,
    @Args() args: UnlinkLoanPaymentArgs,
  ): Promise<Debt> {
    return this.links.unlink(user.id, args.occurrenceId, args.keepPaid);
  }
}
