import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AiFeatureKey, AiProvider, Prisma } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  AiFeatureDisabledError,
  AiModelsService,
  NoUsableAiModelError,
} from './ai-models.service';
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
  extractFromText: jest.fn(),
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
        service.extractFromPdf(request, { aiModelId: 'm-disabled' }),
      ).rejects.toThrow(NoUsableAiModelError);
      expect(prisma.aiModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, supportsPdf: true, id: 'm-disabled' },
        }),
      );
    });
  });

  describe('extractFromText', () => {
    const request = {
      prompt: 'Translate',
      text: 'Mascotas',
      schema: {},
      schemaName: 'translation',
      timeoutMs: 3000,
    };

    it('does not require PDF support and applies the feature', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(null);
      prisma.aiModel.findMany.mockResolvedValue([row({ supportsPdf: false })]);
      anthropic.extractFromText.mockResolvedValue({ en: 'Pets' });

      const result = await service.extractFromText(request, {
        feature: AiFeatureKey.translation,
      });

      expect(prisma.aiFeature.findUnique).toHaveBeenCalledWith({
        where: { key: AiFeatureKey.translation },
      });
      expect(prisma.aiModel.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
      });
      expect(anthropic.extractFromText).toHaveBeenCalledWith({
        ...request,
        modelId: 'claude-haiku-5-5',
      });
      expect(anthropic.extractFromPdf).not.toHaveBeenCalled();
      expect(result).toEqual({
        model: expect.objectContaining({ id: 'm-haiku' }),
        data: { en: 'Pets' },
      });
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
      anthropic.extractFromText.mockRejectedValue(new Error('timeout'));
      openai.extractFromText.mockResolvedValue({ ok: true });

      const result = await service.extractFromText(request);

      expect(result.model.id).toBe('m-gpt');
    });

    it('throws NoUsableAiModelError without usable models', async () => {
      prisma.aiModel.findMany.mockResolvedValue([
        row({ provider: AiProvider.google }),
      ]);

      await expect(service.extractFromText(request)).rejects.toThrow(
        NoUsableAiModelError,
      );
    });

    it('never calls a provider when the feature is off', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue({
        key: AiFeatureKey.translation,
        enabled: false,
        aiModelId: null,
        useFallbacks: true,
        updatedById: null,
        updatedAt: new Date(),
      });

      await expect(
        service.extractFromText(request, { feature: AiFeatureKey.translation }),
      ).rejects.toThrow(AiFeatureDisabledError);
      expect(anthropic.extractFromText).not.toHaveBeenCalled();
    });

    it('a feature without a row uses its defaults (receipt parsing is off)', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(null);

      await expect(
        service.pdfCandidates({ feature: AiFeatureKey.receipt_parsing }),
      ).rejects.toThrow(AiFeatureDisabledError);
    });
  });

  describe('pdfCandidates with a feature', () => {
    const feature = AiFeatureKey.statement_parsing;
    const settings = (overrides: Record<string, unknown> = {}) => ({
      key: feature,
      enabled: true,
      aiModelId: null,
      useFallbacks: true,
      updatedById: null,
      updatedAt: new Date('2026-10-12'),
      ...overrides,
    });
    // Usable, in catalog order: default first.
    const catalog = () => [
      row(),
      row({
        id: 'm-gpt',
        provider: AiProvider.openai,
        modelId: 'gpt-5-mini',
        isDefault: false,
        sortOrder: 20,
      }),
      row({
        id: 'm-sonnet',
        modelId: 'claude-sonnet-5',
        isDefault: false,
        sortOrder: 30,
      }),
    ];

    beforeEach(() => {
      prisma.aiModel.findMany.mockResolvedValue(catalog());
    });

    it('throws AiFeatureDisabledError when the feature is off', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ enabled: false }),
      );

      const result = service.pdfCandidates({ feature });

      await expect(result).rejects.toThrow(AiFeatureDisabledError);
      await expect(result).rejects.toThrow(NoUsableAiModelError);
      expect(prisma.aiFeature.findUnique).toHaveBeenCalledWith({
        where: { key: feature },
      });
      expect(prisma.aiModel.findMany).not.toHaveBeenCalled();
    });

    it('extractFromPdf never calls a provider when the feature is off', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ enabled: false }),
      );

      await expect(
        service.extractFromPdf(
          {
            pdf: Buffer.from('%PDF'),
            prompt: 'p',
            schema: {},
            schemaName: 's',
          },
          { feature },
        ),
      ).rejects.toThrow(AiFeatureDisabledError);
      expect(anthropic.extractFromPdf).not.toHaveBeenCalled();
      expect(openai.extractFromPdf).not.toHaveBeenCalled();
    });

    it('puts its own model first, then the fallbacks', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: 'm-gpt', useFallbacks: true }),
      );

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual([
        'm-gpt',
        'm-haiku',
        'm-sonnet',
      ]);
    });

    it('uses only its own model without fallbacks', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: 'm-gpt', useFallbacks: false }),
      );

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual(['m-gpt']);
    });

    it('returns nothing when its own model is unusable and fallbacks are off', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: 'm-inactive', useFallbacks: false }),
      );

      await expect(service.pdfCandidates({ feature })).resolves.toEqual([]);
    });

    it('falls back to the rest when its own model is unusable', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: 'm-inactive', useFallbacks: true }),
      );

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual([
        'm-haiku',
        'm-gpt',
        'm-sonnet',
      ]);
    });

    it('uses only the default without its own model and without fallbacks', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: null, useFallbacks: false }),
      );

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual(['m-haiku']);
    });

    it('uses the default then the rest without its own model', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: null, useFallbacks: true }),
      );

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual([
        'm-haiku',
        'm-gpt',
        'm-sonnet',
      ]);
    });

    it('behaves like the plain catalog when the feature has no row yet', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(null);

      const candidates = await service.pdfCandidates({ feature });

      expect(candidates.map((m) => m.id)).toEqual([
        'm-haiku',
        'm-gpt',
        'm-sonnet',
      ]);
    });

    it('still checks the feature is on when a model is chosen by id', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ enabled: false }),
      );

      await expect(
        service.pdfCandidates({ feature, aiModelId: 'm-gpt' }),
      ).rejects.toThrow(AiFeatureDisabledError);
    });

    it('with an explicit model id returns only that model', async () => {
      prisma.aiFeature.findUnique.mockResolvedValue(
        settings({ aiModelId: 'm-haiku', useFallbacks: true }),
      );
      prisma.aiModel.findMany.mockResolvedValue([catalog()[1]]);

      const candidates = await service.pdfCandidates({
        feature,
        aiModelId: 'm-gpt',
      });

      expect(prisma.aiModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, supportsPdf: true, id: 'm-gpt' },
        }),
      );
      expect(candidates.map((m) => m.id)).toEqual(['m-gpt']);
    });
  });
});
