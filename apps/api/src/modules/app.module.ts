/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { DebtsModule } from './debts/debts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module';
import { StatementsModule } from './statements/statements.module';
import { AiModule } from './ai/ai.module';
import { PrismaService } from '../services/prisma.service';
import { HealthController } from '../controllers/health.controller';

const isProduction = process.env.NODE_ENV === 'production';

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  return value === undefined ? fallback : value === 'true';
}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Production keeps the schema in memory: the container filesystem is
      // read-only for the app user and schema.gql is a dev artifact.
      autoSchemaFile: isProduction ? true : join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: envFlag('GRAPHQL_PLAYGROUND', !isProduction),
      introspection: envFlag('GRAPHQL_INTROSPECTION', !isProduction),
      context: ({ req, res }) => ({ req, res }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    TransfersModule,
    BudgetsModule,
    GoalsModule,
    DebtsModule,
    NotificationsModule,
    ReportsModule,
    RecurringExpensesModule,
    StatementsModule,
    AiModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
