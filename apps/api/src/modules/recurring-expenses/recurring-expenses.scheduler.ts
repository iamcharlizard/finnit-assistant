import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecurringExpensesService } from './recurring-expenses.service';

@Injectable()
export class RecurringExpensesScheduler {
  private readonly logger = new Logger(RecurringExpensesScheduler.name);

  constructor(private readonly service: RecurringExpensesService) {}

  // Runs in-process: the API has a single replica per environment. With more
  // replicas this needs a lock so only one instance runs it.
  @Cron('0 6 * * *', {
    name: 'recurring-expenses-daily',
    timeZone: 'America/Mexico_City',
  })
  async runDaily(): Promise<void> {
    try {
      const result = await this.service.runDailyMaintenance();
      this.logger.log(
        `Recurring expenses: ${result.generated} occurrences generated, ${result.missed} marked missed, ${result.notified} reminders created`,
      );
    } catch (error) {
      this.logger.error('Recurring expenses daily job failed', error as Error);
    }
  }
}
