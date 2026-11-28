import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { GlobalSettingsService } from './global-settings.service';

describe('GlobalSettingsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: GlobalSettingsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new GlobalSettingsService(prisma);
  });

  it('reads the single row with who changed it last', async () => {
    const updatedAt = new Date('2026-11-27T20:00:00Z');
    prisma.globalSettings.findUnique.mockResolvedValue({
      id: 1,
      bankSyncEnabled: false,
      updatedById: 'admin-1',
      updatedAt,
      updatedBy: { name: 'Ana', email: 'ana@example.com' },
    } as never);
    await expect(service.get()).resolves.toEqual({
      bankSyncEnabled: false,
      updatedByName: 'Ana',
      updatedAt,
    });
    await expect(service.isBankSyncEnabled()).resolves.toBe(false);
  });

  it('falls back to everything on when the row is missing', async () => {
    prisma.globalSettings.findUnique.mockResolvedValue(null);
    await expect(service.isBankSyncEnabled()).resolves.toBe(true);
  });

  it('saves only what changed, and who changed it', async () => {
    prisma.globalSettings.findUnique.mockResolvedValue(null);
    await service.update({ bankSyncEnabled: false }, 'admin-1');
    expect(prisma.globalSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, bankSyncEnabled: false, updatedById: 'admin-1' },
      update: { bankSyncEnabled: false, updatedById: 'admin-1' },
    });
  });
});
