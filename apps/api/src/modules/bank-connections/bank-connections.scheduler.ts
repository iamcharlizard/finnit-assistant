import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BankConnectionsService } from './bank-connections.service';

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
