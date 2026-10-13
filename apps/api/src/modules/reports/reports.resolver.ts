import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import {
  MonthlyReport,
  CashFlowProjection,
  WhatIfInput,
  WhatIfResult,
} from './dto/report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { AppLocale, RequestLocale } from '../translation/locale';

@Resolver()
@UseGuards(JwtAuthGuard)
export class ReportsResolver {
  constructor(private readonly reportsService: ReportsService) {}

  @Query(() => MonthlyReport)
  async monthlyReport(
    @CurrentUser() user: User,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
    @RequestLocale() locale: AppLocale,
  ): Promise<MonthlyReport> {
    return this.reportsService.getMonthlyReport(user.id, year, month, locale);
  }

  @Query(() => [CashFlowProjection])
  async cashFlowProjection(
    @CurrentUser() user: User,
    @Args('monthsAhead', { type: () => Int, defaultValue: 6 })
    monthsAhead: number,
  ): Promise<CashFlowProjection[]> {
    return this.reportsService.getCashFlowProjection(user.id, monthsAhead);
  }

  @Query(() => WhatIfResult)
  async whatIfScenario(
    @CurrentUser() user: User,
    @Args('input') input: WhatIfInput,
  ): Promise<WhatIfResult> {
    return this.reportsService.runWhatIfScenario(user.id, input);
  }
}
