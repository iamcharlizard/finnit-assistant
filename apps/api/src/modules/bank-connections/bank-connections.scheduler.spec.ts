import { mock } from 'jest-mock-extended';
import { BankConnectionsService } from './bank-connections.service';
import {
  BankConnectionsScheduler,
  isScheduledBankSyncEnabled,
} from './bank-connections.scheduler';

describe('isScheduledBankSyncEnabled', () => {
  it('runs only in production', () => {
    expect(isScheduledBankSyncEnabled({ NODE_ENV: 'production' })).toBe(true);
    expect(isScheduledBankSyncEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(isScheduledBankSyncEnabled({})).toBe(false);
  });

  it('ignores the old BANK_SYNC_SCHEDULED variable', () => {
    expect(
      isScheduledBankSyncEnabled({
        NODE_ENV: 'development',
        BANK_SYNC_SCHEDULED: 'true',
      }),
    ).toBe(false);
  });
});

describe('BankConnectionsScheduler', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('does not sync outside production', async () => {
    process.env.NODE_ENV = 'development';
    const banks = mock<BankConnectionsService>();
    await new BankConnectionsScheduler(banks).run();
    expect(banks.isSyncAvailable).not.toHaveBeenCalled();
    expect(banks.syncAll).not.toHaveBeenCalled();
  });

  it('does not sync while an admin has it turned off', async () => {
    process.env.NODE_ENV = 'production';
    const banks = mock<BankConnectionsService>();
    banks.isSyncAvailable.mockResolvedValue(false);
    await new BankConnectionsScheduler(banks).run();
    expect(banks.syncAll).not.toHaveBeenCalled();
  });

  it('syncs every connection when it is on', async () => {
    process.env.NODE_ENV = 'production';
    const banks = mock<BankConnectionsService>();
    banks.isSyncAvailable.mockResolvedValue(true);
    banks.syncAll.mockResolvedValue({ synced: 1, failed: 0 });
    await new BankConnectionsScheduler(banks).run();
    expect(banks.syncAll).toHaveBeenCalledTimes(1);
  });
});
