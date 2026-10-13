import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BankConnectionsService } from './bank-connections.service';

/**
 * Whether the scheduled bank sync runs. BANK_SYNC_SCHEDULED=true|false wins;
 * otherwise it runs only in production (testing also sets
 * NODE_ENV=production), so a local API with a copy of real data never logs
 * in to anyone's bank on its own.
 */
export function isScheduledBankSyncEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.BANK_SYNC_SCHEDULED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV === 'production';
}

@Injectable()
export class BankConnectionsScheduler implements OnModuleInit {
  private readonly logger = new Logger(BankConnectionsScheduler.name);

  constructor(private readonly banks: BankConnectionsService) {}

  onModuleInit() {
    if (!isScheduledBankSyncEnabled()) {
      this.logger.log(
        'Scheduled bank sync is off (set BANK_SYNC_SCHEDULED=true to turn it on)',
      );
    }
  }

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
