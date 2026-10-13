import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../common/types/models/user.model';
import { BankConnectionsService } from './bank-connections.service';
import {
  BankConnection,
  BankSyncResult,
  BankWidgetSession,
  LinkBankAccountInput,
} from './dto/bank-connection.dto';

@Resolver(() => BankConnection)
@UseGuards(JwtAuthGuard)
export class BankConnectionsResolver {
  constructor(private readonly banks: BankConnectionsService) {}

  @Query(() => [BankConnection])
  async bankConnections(@CurrentUser() user: User): Promise<BankConnection[]> {
    return this.banks.list(user.id);
  }

  @Mutation(() => BankWidgetSession, {
    description:
      'Session for the Syncfy widget, where the user connects the bank. Call registerBankConnection with the id_credential the widget returns.',
  })
  async createBankWidgetSession(
    @CurrentUser() user: User,
  ): Promise<BankWidgetSession> {
    return this.banks.widgetSession(user.id);
  }

  @Mutation(() => BankSyncResult)
  async registerBankConnection(
    @CurrentUser() user: User,
    @Args('idCredential') idCredential: string,
  ): Promise<BankSyncResult> {
    return this.banks.register(user.id, idCredential);
  }

  @Mutation(() => BankSyncResult, {
    description:
      'Links a bank account to a Finnit account (or creates one) and imports its last 90 days',
  })
  async linkBankAccount(
    @CurrentUser() user: User,
    @Args('linkedAccountId', { type: () => ID }) linkedAccountId: string,
    @Args('input') input: LinkBankAccountInput,
  ): Promise<BankSyncResult> {
    return this.banks.linkAccount(user.id, linkedAccountId, input);
  }

  @Mutation(() => BankConnection)
  async unlinkBankAccount(
    @CurrentUser() user: User,
    @Args('linkedAccountId', { type: () => ID }) linkedAccountId: string,
  ): Promise<BankConnection> {
    return this.banks.unlinkAccount(user.id, linkedAccountId);
  }

  @Mutation(() => BankSyncResult, {
    description:
      'Imports new movements. refreshFromBank asks Syncfy to log in to the bank again (at most once an hour); its data arrives on the next sync.',
  })
  async syncBankConnection(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('refreshFromBank', { defaultValue: false }) refreshFromBank: boolean,
  ): Promise<BankSyncResult> {
    return this.banks.sync(id, user.id, { requestRefresh: refreshFromBank });
  }

  @Mutation(() => Boolean, {
    description:
      'Removes the connection from Finnit; imported transactions stay. Delete the bank login in Syncfy separately.',
  })
  async deleteBankConnection(
    @CurrentUser() user: User,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.banks.delete(user.id, id);
  }

  @Mutation(() => Boolean, {
    description:
      'Admin only: maps a Finnit user (by email) to an existing Syncfy user (id_user or id_external)',
  })
  @UseGuards(AdminGuard)
  async linkSyncfyUser(
    @Args('email') email: string,
    @Args('syncfyUser') syncfyUser: string,
  ): Promise<boolean> {
    return this.banks.linkProviderUser(email, syncfyUser);
  }
}
