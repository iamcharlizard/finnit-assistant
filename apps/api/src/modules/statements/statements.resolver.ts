import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { StatementsService } from './statements.service';
import {
  CardMonthSummary,
  CardMonthSummaryArgs,
  StatementImport,
  StatementImportConnection,
  StatementImportsArgs,
  StatementLine,
  UpdateStatementLineInput,
} from './dto/statement.dto';

@Resolver(() => StatementImport)
@UseGuards(JwtAuthGuard)
export class StatementsResolver {
  constructor(private readonly statements: StatementsService) {}

  @Query(() => StatementImportConnection)
  async statementImports(
    @CurrentUser() user: User,
    @Args() args: StatementImportsArgs,
  ): Promise<StatementImportConnection> {
    return this.statements.findMany(user.id, args);
  }

  @Query(() => StatementImport, {
    description:
      'Includes the lines; poll it after uploading to follow the status',
  })
  async statementImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<StatementImport> {
    return this.statements.findById(id, user.id);
  }

  @Query(() => String, {
    description: 'Temporary (5 min) download URL of the uploaded PDF',
  })
  async statementFileUrl(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<string> {
    return this.statements.fileUrl(id, user.id);
  }

  @Query(() => CardMonthSummary)
  async cardMonthSummary(
    @CurrentUser() user: User,
    @Args() args: CardMonthSummaryArgs,
  ): Promise<CardMonthSummary> {
    return this.statements.cardMonthSummary(user.id, args);
  }

  @Mutation(() => StatementLine)
  async updateStatementLine(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStatementLineInput,
  ): Promise<StatementLine> {
    return this.statements.updateLine(id, user.id, input);
  }

  @Mutation(() => StatementImport, {
    description:
      'Creates the pending movements as transactions and marks matched recurring payments as paid',
  })
  async confirmStatementImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<StatementImport> {
    return this.statements.confirm(id, user.id);
  }

  @Mutation(() => StatementImport, {
    description:
      'Extracts the PDF again, optionally with a specific parser (e.g. "claude")',
  })
  async reprocessStatementImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('parser', { nullable: true }) parser?: string,
  ): Promise<StatementImport> {
    return this.statements.reprocess(id, user.id, parser);
  }

  @Mutation(() => Boolean)
  async deleteStatementImport(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.statements.delete(id, user.id);
  }
}
