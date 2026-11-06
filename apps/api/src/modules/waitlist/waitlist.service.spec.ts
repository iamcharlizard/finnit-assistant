import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { WaitlistService } from './waitlist.service';

describe('WaitlistService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: WaitlistService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new WaitlistService(prisma);
  });

  it('stores the email lowercased, once', async () => {
    const result = await service.join({
      email: '  Ada@Example.COM ',
      locale: 'es',
      source: 'Instagram',
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.waitlistEntry.upsert).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' },
      create: { email: 'ada@example.com', locale: 'es', source: 'instagram' },
      update: {},
    });
  });

  it('answers the same when the email was already there', async () => {
    await service.join({ email: 'ada@example.com' });
    const again = await service.join({ email: 'ada@example.com' });
    expect(again).toEqual({ ok: true });
  });

  it('drops a source that is not a plain campaign name', async () => {
    await service.join({ email: 'ada@example.com', source: '<script>' });
    expect(prisma.waitlistEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { email: 'ada@example.com', locale: null, source: null },
      }),
    );
  });

  it('rejects invalid emails without touching the database', async () => {
    await expect(service.join({ email: 'not-an-email' })).rejects.toThrow(
      ValidationError,
    );
    expect(prisma.waitlistEntry.upsert).not.toHaveBeenCalled();
  });
});
