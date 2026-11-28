import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BankConnectionsService } from './bank-connections.service';

/**
 * Whether this server runs the scheduled bank sync at all: only in
 * production (testing also sets NODE_ENV=production), so a local API with a
 * copy of real data never logs in to anyone's bank on its own. Where it
 * runs, admins turn it on or off in "Configuración global"
 * (GlobalSettings.bankSyncEnabled).
 */
export function isScheduledBankSyncEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'production';
}

@Injectable()
export class BankConnectionsScheduler {
  private readonly logger = new Logger(BankConnectionsScheduler.name);

  constructor(private readonly banks: BankConnectionsService) {}

  // Twice a day: the morning run asks Syncfy to refresh from the bank (at most
  // once every 20 h per connection) and the afternoon run imports what that
  // refresh brought. Single API replica, so no distributed lock.
  @Cron('0 7,15 * * *', {
    name: 'bank-connections-sync',
    timeZone: 'America/Mexico_City',
  })
  async run(): Promise<void> {
    if (!isScheduledBankSyncEnabled()) return;
    try {
      if (!(await this.banks.isSyncAvailable())) {
        this.logger.log(
          'Bank sync skipped: turned off in Configuración global (or Syncfy is not configured)',
        );
        return;
      }
      const { synced, failed } = await this.banks.syncAll();
      if (synced || failed) {
        this.logger.log(
          `Bank sync: ${synced} connections synced, ${failed} failed`,
        );
      }
    } catch (error) {
      this.logger.error('Bank sync job failed', error as Error);
    }
  }
}
