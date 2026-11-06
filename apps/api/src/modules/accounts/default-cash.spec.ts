import { mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { defaultCashName, ensureDefaultCashAccount } from './default-cash';

describe('ensureDefaultCashAccount', () => {
  const userId = 'user-1';

  it('does nothing when the user already has it', async () => {
    const db = mockDeep<PrismaService>();
    db.account.findFirst.mockResolvedValueOnce({ id: 'cash' } as never);

    await ensureDefaultCashAccount(db, userId, 'es');

    expect(db.account.update).not.toHaveBeenCalled();
    expect(db.account.create).not.toHaveBeenCalled();
  });

  it('marks the oldest open cash account', async () => {
    const db = mockDeep<PrismaService>();
    db.account.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'wallet' } as never);

    await ensureDefaultCashAccount(db, userId, 'es');

    expect(db.account.findFirst.mock.calls[1][0]).toMatchObject({
      where: { userId, type: 'cash', archived: false },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(db.account.update).toHaveBeenCalledWith({
      where: { id: 'wallet' },
      data: { isDefaultCash: true },
    });
    expect(db.account.create).not.toHaveBeenCalled();
  });

  it('creates "Efectivo" (or "Cash"), avoiding a taken name', async () => {
    const db = mockDeep<PrismaService>();
    db.account.findFirst.mockResolvedValue(null);

    await ensureDefaultCashAccount(db, userId, 'es');
    expect(db.account.create.mock.calls[0][0].data).toMatchObject({
      userId,
      type: 'cash',
      name: 'Efectivo',
      currency: 'MXN',
      balanceCurrent: 0,
      isDefaultCash: true,
    });

    db.account.findFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'taken' } as never);
    await ensureDefaultCashAccount(db, userId, 'en');
    expect(db.account.create.mock.calls[1][0].data.name).toBe('Cash 2');
  });

  it('names it in the user language', () => {
    expect(defaultCashName('es')).toBe('Efectivo');
    expect(defaultCashName('en')).toBe('Cash');
    expect(defaultCashName(null)).toBe('Efectivo');
  });
});
