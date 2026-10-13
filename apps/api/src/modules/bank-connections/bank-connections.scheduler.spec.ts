import { mock } from 'jest-mock-extended';
import { BankConnectionsService } from './bank-connections.service';
import {
  BankConnectionsScheduler,
  isScheduledBankSyncEnabled,
} from './bank-connections.scheduler';

describe('isScheduledBankSyncEnabled', () => {
  it('runs only in production by default', () => {
    expect(isScheduledBankSyncEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(isScheduledBankSyncEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isScheduledBankSyncEnabled({})).toBe(false);
  });

  it('BANK_SYNC_SCHEDULED overrides the environment', () => {
    expect(
      isScheduledBankSyncEnabled({
        NODE_ENV: 'development',
        BANK_SYNC_SCHEDULED: 'true',
      }),
    ).toBe(true);
    expect(
      isScheduledBankSyncEnabled({
        NODE_ENV: 'production',
        BANK_SYNC_SCHEDULED: ' FALSE ',
      }),
    ).toBe(false);
    // Anything else falls back to NODE_ENV.
    expect(
      isScheduledBankSyncEnabled({
        NODE_ENV: 'production',
        BANK_SYNC_SCHEDULED: '',
      }),
    ).toBe(true);
  });
});

describe('BankConnectionsScheduler', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('does not sync when the scheduled sync is off', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.BANK_SYNC_SCHEDULED;
    const banks = mock<BankConnectionsService>();
    await new BankConnectionsScheduler(banks).run();
    expect(banks.syncAll).not.toHaveBeenCalled();
  });

  it('syncs every connection when it is on', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BANK_SYNC_SCHEDULED;
    const banks = mock<BankConnectionsService>();
    banks.syncAll.mockResolvedValue({ synced: 1, failed: 0 });
    await new BankConnectionsScheduler(banks).run();
    expect(banks.syncAll).toHaveBeenCalledTimes(1);
  });
});
