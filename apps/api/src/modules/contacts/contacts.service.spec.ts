import { mockDeep } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { ContactsService, contactName } from './contacts.service';

describe('ContactsService', () => {
  it('normalizes names', () => {
    expect(contactName('  Ana   López ')).toBe('Ana López');
  });

  it('returns the contact with the same name, ignoring case', async () => {
    const prisma = mockDeep<PrismaService>();
    const ana = { id: 'c1', name: 'Ana', createdAt: new Date() };
    prisma.contact.findFirst.mockResolvedValue(ana as never);

    await expect(
      new ContactsService(prisma).create('user-1', ' ana '),
    ).resolves.toBe(ana);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          name: { equals: 'ana', mode: 'insensitive' },
        },
      }),
    );
    expect(prisma.contact.upsert).not.toHaveBeenCalled();
  });

  it('creates a new one and refuses an empty name', async () => {
    const prisma = mockDeep<PrismaService>();
    prisma.contact.findFirst.mockResolvedValue(null);
    prisma.contact.upsert.mockResolvedValue({
      id: 'c2',
      name: 'Luis',
    } as never);
    const service = new ContactsService(prisma);

    await expect(service.create('user-1', 'Luis')).resolves.toMatchObject({
      id: 'c2',
    });
    await expect(service.create('user-1', '   ')).rejects.toThrow(
      ValidationError,
    );
  });
});
