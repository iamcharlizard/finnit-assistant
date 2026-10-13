import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AiProvider, Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import { AiModelsService, NoUsableAiModelError } from './ai-models.service';
import { AiProviderClient, AiProviderError } from './providers/ai-provider';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-haiku',
  provider: AiProvider.anthropic,
  modelId: 'claude-haiku-5-5',
  label: 'Claude Haiku 5.5',
  isActive: true,
  isDefault: true,
  supportsPdf: true,
  sortOrder: 10,
  createdAt: new Date('2026-10-12'),
  updatedAt: new Date('2026-10-12'),
  ...overrides,
});

const fakeProvider = (
  provider: AiProvider,
  isConfigured: boolean,
): jest.Mocked<AiProviderClient> => ({
  provider,
  apiKeyEnv: `${provider.toUpperCase()}_KEY`,
  isConfigured,
  extractFromPdf: jest.fn(),
});

describe('AiModelsService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let anthropic: jest.Mocked<AiProviderClient>;
  let openai: jest.Mocked<AiProviderClient>;
  let google: jest.Mocked<AiProviderClient>;
  let service: AiModelsService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(
      (fn: unknown) => (fn as (tx: unknown) => unknown)(prisma) as never,
    );
    anthropic = fakeProvider(AiProvider.anthropic, true);
    openai = fakeProvider(AiProvider.openai, true);
    google = fakeProvider(AiProvider.google, false);
    service = new AiModelsService(prisma, [anthropic, openai, google]);
  });

  describe('list', () => {
    it('reports whether each model can be used', async () => {
      prisma.aiModel.findMany.mockResolvedValue([
        row(),
        row({
          id: 'm-gemini',
          provider: AiProvider.google,
          modelId: 'gemini-2.5-flash',
          isDefault: false,
        }),
        row({
          id: 'm-gpt',
          provider: AiProvider.openai,
          isActive: false,
          isDefault: false,
        }),
      ]);

      const models = await service.list({ activeOnly: false });

      expect(models.map((m) => [m.id, m.providerConfigured, m.usable])).toEqual(
        [
          ['m-haiku', true, true],
          ['m-gemini', false, false],
          ['m-gpt', true, false],
        ],
      );
    });

    it('filters active models', async () => {
      prisma.aiModel.findMany.mockResolvedValue([]);
      await service.list({ activeOnly: true });
      expect(prisma.aiModel.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [
          { isDefault: 'desc' },
          { sortOrder: 'asc' },
          { label: 'asc' },
        ],
      });
    });
  });

  describe('create and update', () => {
    it('keeps a single default model', async () => {
      prisma.aiModel.create.mockResolvedValue(row());
      await service.create({
        provider: AiProvider.anthropic,
        modelId: ' claude-haiku-5-5 ',
        label: 'Haiku',
        isActive: true,
        isDefault: true,
      });
      expect(prisma.aiModel.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.aiModel.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ modelId: 'claude-haiku-5-5' }),
      });
    });

    it('rejects an inactive default', async () => {
      await expect(
        service.create({
          provider: AiProvider.openai,
          modelId: 'gpt-5',
          label: 'GPT-5',
          isDefault: true,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('maps a duplicate model to a ConflictError', async () => {
      prisma.aiModel.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(
        service.create({
          provider: AiProvider.openai,
          modelId: 'gpt-5',
          label: 'GPT-5',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('unsets the default when the default model is deactivated', async () => {
      prisma.aiModel.findUnique.mockResolvedValue(row());
      prisma.aiModel.update.mockResolvedValue(
        row({ isActive: false, isDefault: false }),
      );

      await service.update('m-haiku', { isActive: false });

      expect(prisma.aiModel.update).toHaveBeenCalledWith({
        where: { id: 'm-haiku' },
        data: expect.objectContaining({ isActive: false, isDefault: false }),
      });
    });

    it('moves the default to another model', async () => {
      prisma.aiModel.findUnique.mockResolvedValue(
        row({
          id: 'm-gpt',
          provider: AiProvider.openai,
          isDefault: false,
        }),
      );
      prisma.aiModel.update.mockResolvedValue(row({ id: 'm-gpt' }));

      await service.update('m-gpt', { isDefault: true });

      expect(prisma.aiModel.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    });
  });

  describe('extractFromPdf', () => {
    const request = {
      pdf: Buffer.from('%PDF'),
      prompt: 'p',
      schema: {},
      schemaName: 's',
    };

    it('only offers active PDF models whose provider is configured', async () => {
      prisma.aiModel.findMany.mockResolvedValue([
        row(),
        row({ id: 'm-gemini', provider: AiProvider.google, isDefault: false }),
      ]);

      const candidates = await service.pdfCandidates();

      expect(prisma.aiModel.findMany).toHaveBeenCalledWith({
        where: { isActive: true, supportsPdf: true },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      });
      expect(candidates.map((m) => m.id)).toEqual(['m-haiku']);
    });

    it('falls back to the next model when one fails', async () => {
      prisma.aiModel.findMany.mockResolvedValue([
        row(),
        row({
          id: 'm-gpt',
          provider: AiProvider.openai,
          modelId: 'gpt-5-mini',
          isDefault: false,
        }),
      ]);
      anthropic.extractFromPdf.mockRejectedValue(
        new AiProviderError(AiProvider.anthropic, 'overloaded'),
      );
      openai.extractFromPdf.mockResolvedValue({ ok: true });

      const result = await service.extractFromPdf(request);

      expect(openai.extractFromPdf).toHaveBeenCalledWith({
        ...request,
        modelId: 'gpt-5-mini',
      });
      expect(result).toEqual({
        model: expect.objectContaining({ id: 'm-gpt' }),
        data: { ok: true },
      });
    });

    it('reports every failure when all models fail', async () => {
      prisma.aiModel.findMany.mockResolvedValue([row()]);
      anthropic.extractFromPdf.mockRejectedValue(new Error('timeout'));
      await expect(service.extractFromPdf(request)).rejects.toThrow(
        'every model failed (Claude Haiku 5.5: anthropic: timeout)',
      );
    });

    it('never uses a disabled model, even by id', async () => {
      prisma.aiModel.findMany.mockResolvedValue([]);
      await expect(
        service.extractFromPdf(request, 'm-disabled'),
      ).rejects.toThrow(NoUsableAiModelError);
      expect(prisma.aiModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, supportsPdf: true, id: 'm-disabled' },
        }),
      );
    });
  });
});
