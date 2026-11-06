import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AliasMatchType } from '@finnit/database';

import { PrismaService } from '../../services/prisma.service';
import { PrivacyLockedError } from '../../common/exceptions/graphql-error.exception';
import { AiModelsService } from '../ai/ai-models.service';
import { AliasPatternService } from './alias-pattern.service';
import { AliasPatternSource } from './dto/merchant-alias.dto';
import { MerchantAliasesService } from './merchant-aliases.service';

const EXAMPLES = [
  { merchantName: 'KSK*VID ONLYFANSFPA 231020BF8MX', description: null },
  { merchantName: 'KSK*VID ONLYFANSFPA 241105AA1MX', description: null },
];
const PREVIEW = { count: 6, withOwnName: 0, withOtherRule: 0, samples: [] };

describe('AliasPatternService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let ai: DeepMockProxy<AiModelsService>;
  let aliases: DeepMockProxy<MerchantAliasesService>;
  let service: AliasPatternService;
  /** What Postgres says each candidate matches. */
  let matches: (pattern: string, text: string) => boolean;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    ai = mockDeep<AiModelsService>();
    aliases = mockDeep<MerchantAliasesService>();
    prisma.transaction.count.mockResolvedValue(0);
    prisma.transaction.findMany.mockResolvedValue(EXAMPLES as never);
    prisma.user.findUnique.mockResolvedValue({ locale: 'es' } as never);
    aliases.preview.mockResolvedValue(PREVIEW);
    matches = (pattern, text) =>
      text.toUpperCase().includes(pattern.toUpperCase());
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) =>
      fn({
        $executeRawUnsafe: jest.fn(),
        $queryRaw: jest.fn((sql: { values: unknown[] }) => {
          const pattern = String(sql.values.find((v) => typeof v === 'string'));
          const texts = sql.values.find(Array.isArray) as string[];
          return Promise.resolve(
            texts.map((text) => ({ text, ok: matches(pattern, text) })),
          );
        }),
      })) as never);
    service = new AliasPatternService(prisma, ai, aliases);
  });

  it("uses the AI's rule when it covers every example", async () => {
    ai.extractFromText.mockResolvedValue({
      data: {
        matchType: 'contains',
        pattern: 'ONLYFANS',
        explanation: 'Busca «ONLYFANS».',
      },
    } as never);

    const result = await service.suggest('u1', { transactionIds: ['a', 'b'] });

    expect(result).toMatchObject({
      matchType: AliasMatchType.contains,
      pattern: 'ONLYFANS',
      source: AliasPatternSource.ai,
      coversAll: true,
      aiUnavailable: false,
      preview: PREVIEW,
    });
    expect(ai.extractFromText).toHaveBeenCalledTimes(1);
  });

  it('retries telling the AI what it missed, then falls back to the shared words', async () => {
    ai.extractFromText.mockResolvedValue({
      data: { matchType: 'contains', pattern: '231020BF8MX', explanation: '' },
    } as never);

    const result = await service.suggest('u1', { transactionIds: ['a', 'b'] });

    expect(ai.extractFromText).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(ai.extractFromText.mock.calls[1][0].text) as {
      previousAttempt: { didNotMatch: string[] };
    };
    expect(retry.previousAttempt.didNotMatch).toEqual([
      'KSK*VID ONLYFANSFPA 241105AA1MX',
    ]);
    expect(result).toMatchObject({
      pattern: 'KSK*VID ONLYFANSFPA',
      source: AliasPatternSource.heuristic,
      coversAll: true,
    });
  });

  it('says when the AI could not be used', async () => {
    ai.extractFromText.mockRejectedValue(new Error('No active AI model'));
    const result = await service.suggest('u1', { transactionIds: ['a', 'b'] });
    expect(result.aiUnavailable).toBe(true);
    expect(result.pattern).toBe('KSK*VID ONLYFANSFPA');
  });

  it("needs the privacy PIN for a protected rule's movements", async () => {
    prisma.transaction.count.mockResolvedValue(1);
    await expect(
      service.suggest('u1', { transactionIds: ['a'] }),
    ).rejects.toThrow(PrivacyLockedError);
    expect(ai.extractFromText).not.toHaveBeenCalled();
  });
});
