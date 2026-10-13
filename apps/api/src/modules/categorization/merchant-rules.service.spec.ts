import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../services/prisma.service';
import { NotFoundError } from '../../common/exceptions/graphql-error.exception';
import {
  MerchantRulesService,
  ruleKey,
  rulePattern,
  ruleText,
} from './merchant-rules.service';

const userId = 'user-1';

describe('merchant rule normalization', () => {
  it('reuses the recurring-detection merchant normalization', () => {
    expect(rulePattern('KSK*VID ONLYFANS FPA 231020BF8MX')).toBe(
      'KSK VID ONLYFANS',
    );
    expect(rulePattern('Café  Ñandú 1234')).toBe('CAFE NANDU');
    expect(ruleKey('APPLE.COM/BILL')).toBe(ruleKey('APPLE COM BILL'));
  });

  it('ignores texts too generic to learn from', () => {
    expect(rulePattern('12345')).toBeNull();
    expect(rulePattern('AB')).toBeNull();
    expect(rulePattern(null)).toBeNull();
  });

  it('reads merchantName, else description', () => {
    expect(ruleText({ merchantName: ' ', description: 'OXXO' })).toBe('OXXO');
    expect(ruleText({ merchantName: 'UBER', description: 'x' })).toBe('UBER');
  });
});

describe('MerchantRulesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: MerchantRulesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new MerchantRulesService(prisma);
  });

  it('matches texts against the rules by key (spaces do not matter)', async () => {
    prisma.merchantRule.findMany.mockResolvedValue([
      { id: 'r1', pattern: 'OXXO GAS', categoryId: 'fuel' },
    ] as never);

    const matches = await service.match(userId, [
      'OXXOGAS 1234 CDMX',
      'oxxo gas',
      'Starbucks',
      null,
    ]);

    expect(prisma.merchantRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId } }),
    );
    expect(matches.get('oxxo gas')).toEqual({
      ruleId: 'r1',
      categoryId: 'fuel',
    });
    expect(matches.has('Starbucks')).toBe(false);
  });

  it('does not query when no text can match', async () => {
    await service.match(userId, [null, '12']);
    expect(prisma.merchantRule.findMany).not.toHaveBeenCalled();
  });

  it('learns one rule per distinct merchant; hits grow per movement', async () => {
    prisma.merchantRule.findMany.mockResolvedValue([
      { id: 'r1', pattern: 'OXXO GAS', categoryId: 'old' },
    ] as never);

    const learned = await service.learn(prisma, userId, [
      { text: 'OXXO GAS 001', categoryId: 'fuel' },
      { text: 'OXXOGAS', categoryId: 'fuel' },
      { text: 'Farmacia del Ahorro', categoryId: 'health' },
      { text: '9999', categoryId: 'health' },
    ]);

    expect(learned).toBe(2);
    expect(prisma.merchantRule.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { categoryId: 'fuel', hits: { increment: 2 } },
    });
    expect(prisma.merchantRule.upsert).toHaveBeenCalledWith({
      where: { userId_pattern: { userId, pattern: 'FARMACIA DEL AHORRO' } },
      create: {
        userId,
        pattern: 'FARMACIA DEL AHORRO',
        categoryId: 'health',
        hits: 1,
      },
      update: { categoryId: 'health', hits: { increment: 1 } },
    });
  });

  it("deletes only the user's own rule", async () => {
    prisma.merchantRule.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.delete(userId, 'r9')).rejects.toThrow(NotFoundError);
    expect(prisma.merchantRule.deleteMany).toHaveBeenCalledWith({
      where: { id: 'r9', userId },
    });
  });
});
