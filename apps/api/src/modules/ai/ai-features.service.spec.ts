import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AiFeatureKey, AiProvider } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { AiFeaturesService } from './ai-features.service';
import {
  AiFeatureDisabledError,
  AiModelsService,
  NoUsableAiModelError,
} from './ai-models.service';

const model = (overrides: Record<string, unknown> = {}) => ({
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

const featureRow = (overrides: Record<string, unknown> = {}) => ({
  key: AiFeatureKey.statement_parsing,
  enabled: true,
  aiModelId: null,
  useFallbacks: true,
  updatedById: null,
  updatedAt: new Date('2026-10-13'),
  aiModel: null,
  updatedBy: null,
  ...overrides,
});

describe('AiFeaturesService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let aiModels: DeepMockProxy<AiModelsService>;
  let service: AiFeaturesService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    aiModels = mockDeep<AiModelsService>();
    aiModels.map.mockImplementation((row) => ({
      ...row,
      providerConfigured: true,
      usable: row.isActive,
    }));
    aiModels.candidates.mockResolvedValue([model()]);
    service = new AiFeaturesService(prisma, aiModels);
  });

  describe('list', () => {
    it('creates the rows of features missing from the database', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([featureRow()] as never);

      await service.list();

      expect(prisma.aiFeature.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { key: 'statement_parsing', enabled: true, useFallbacks: true },
          { key: 'translation', enabled: true, useFallbacks: true },
          // Receipt parsing starts off.
          { key: 'receipt_parsing', enabled: false, useFallbacks: true },
        ]),
        skipDuplicates: true,
      });
      expect(prisma.aiFeature.createMany.mock.calls[0][0]!.data).toHaveLength(
        Object.values(AiFeatureKey).length,
      );
      expect(
        prisma.aiFeature.createMany.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.aiFeature.findMany.mock.invocationCallOrder[0]);
    });

    it('maps the model and who changed it, and computes usable', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([
        featureRow({
          aiModelId: 'm-haiku',
          aiModel: model(),
          updatedById: 'admin-1',
          updatedBy: { name: 'Ada' },
        }),
      ] as never);

      const [feature] = await service.list();

      expect(aiModels.candidates).toHaveBeenCalledWith({
        feature: AiFeatureKey.statement_parsing,
        requirePdf: true,
      });
      expect(feature).toEqual({
        key: AiFeatureKey.statement_parsing,
        enabled: true,
        aiModel: expect.objectContaining({ id: 'm-haiku', usable: true }),
        useFallbacks: true,
        usable: true,
        updatedByName: 'Ada',
        updatedAt: new Date('2026-10-13'),
      });
    });

    it('text features do not require PDF support', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([
        featureRow({ key: AiFeatureKey.translation }),
      ] as never);

      await service.list();

      expect(aiModels.candidates).toHaveBeenCalledWith({
        feature: AiFeatureKey.translation,
        requirePdf: false,
      });
    });

    it('is not usable when no model it may use is usable', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([featureRow()] as never);
      aiModels.candidates.mockResolvedValue([]);

      const [feature] = await service.list();

      expect(feature.usable).toBe(false);
      expect(feature.aiModel).toBeUndefined();
    });

    it('is not usable when disabled, without asking for candidates', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([
        featureRow({ enabled: false }),
      ] as never);

      const [feature] = await service.list();

      expect(feature.usable).toBe(false);
      expect(aiModels.candidates).not.toHaveBeenCalled();
    });

    it('treats NoUsableAiModelError as not usable', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([featureRow()] as never);
      aiModels.candidates.mockRejectedValue(
        new AiFeatureDisabledError(AiFeatureKey.statement_parsing),
      );

      const [feature] = await service.list();

      expect(feature.usable).toBe(false);
    });

    it('lets other errors through', async () => {
      prisma.aiFeature.findMany.mockResolvedValue([featureRow()] as never);
      aiModels.candidates.mockRejectedValue(new Error('db down'));

      await expect(service.list()).rejects.toThrow('db down');
    });
  });

  describe('update', () => {
    const key = AiFeatureKey.statement_parsing;

    beforeEach(() => {
      prisma.aiFeature.upsert.mockResolvedValue(featureRow());
    });

    it('accepts an active model with PDF support', async () => {
      prisma.aiModel.findUnique.mockResolvedValue(model());

      await service.update(
        key,
        { aiModelId: 'm-haiku', useFallbacks: false },
        'admin-1',
      );

      const data = {
        aiModelId: 'm-haiku',
        useFallbacks: false,
        updatedById: 'admin-1',
      };
      expect(prisma.aiModel.findUnique).toHaveBeenCalledWith({
        where: { id: 'm-haiku' },
      });
      expect(prisma.aiFeature.upsert).toHaveBeenCalledWith({
        where: { key },
        create: { key, enabled: true, ...data },
        update: data,
        include: expect.any(Object),
      });
    });

    it.each([
      ['an inactive model', model({ isActive: false })],
      ['a model without PDF support', model({ supportsPdf: false })],
      ['an unknown model', null],
    ])('rejects %s', async (_case, found) => {
      prisma.aiModel.findUnique.mockResolvedValue(found);

      await expect(
        service.update(key, { aiModelId: 'm-x' }, 'admin-1'),
      ).rejects.toThrow(ValidationError);
      expect(prisma.aiFeature.upsert).not.toHaveBeenCalled();
    });

    it('accepts a model without PDF support for a text feature', async () => {
      prisma.aiModel.findUnique.mockResolvedValue(
        model({ supportsPdf: false }),
      );

      await service.update(
        AiFeatureKey.translation,
        { aiModelId: 'm-haiku' },
        'admin-1',
      );

      expect(prisma.aiFeature.upsert).toHaveBeenCalled();
    });

    it('creates a missing row with the feature defaults', async () => {
      await service.update(
        AiFeatureKey.receipt_parsing,
        { useFallbacks: false },
        'admin-1',
      );

      expect(prisma.aiFeature.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: {
            key: AiFeatureKey.receipt_parsing,
            enabled: false,
            useFallbacks: false,
            updatedById: 'admin-1',
          },
        }),
      );
    });

    it('null goes back to the default model without validation', async () => {
      await service.update(key, { aiModelId: null }, 'admin-1');

      expect(prisma.aiModel.findUnique).not.toHaveBeenCalled();
      expect(prisma.aiFeature.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { aiModelId: null, updatedById: 'admin-1' },
        }),
      );
    });

    it('only writes the fields that were sent', async () => {
      await service.update(key, { enabled: false }, 'admin-1');

      expect(prisma.aiFeature.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { enabled: false, updatedById: 'admin-1' },
        }),
      );
    });

    it('NoUsableAiModelError is the base of the disabled error', () => {
      // AiFeaturesService relies on this to treat "off" as "not usable".
      expect(
        new AiFeatureDisabledError(key) instanceof NoUsableAiModelError,
      ).toBe(true);
    });
  });
});
