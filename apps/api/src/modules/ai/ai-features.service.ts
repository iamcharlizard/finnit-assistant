import { Injectable } from '@nestjs/common';
import { AiFeatureKey } from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import { ValidationError } from '../../common/exceptions/graphql-error.exception';
import { AiModelsService, NoUsableAiModelError } from './ai-models.service';
import { AiFeature, UpdateAiFeatureInput } from './dto/ai-feature.dto';

const include = {
  aiModel: true,
  updatedBy: { select: { name: true } },
} as const;

/** On/off, model and fallbacks per AI feature (admin panel). */
@Injectable()
export class AiFeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiModels: AiModelsService,
  ) {}

  async list(): Promise<AiFeature[]> {
    // Every feature has a row, even ones added after the seed migration.
    await this.prisma.aiFeature.createMany({
      data: Object.values(AiFeatureKey).map((key) => ({ key })),
      skipDuplicates: true,
    });
    const rows = await this.prisma.aiFeature.findMany({
      include,
      orderBy: { key: 'asc' },
    });
    return Promise.all(rows.map((row) => this.map(row)));
  }

  async update(
    key: AiFeatureKey,
    input: UpdateAiFeatureInput,
    actorId: string,
  ): Promise<AiFeature> {
    if (input.aiModelId) {
      const model = await this.prisma.aiModel.findUnique({
        where: { id: input.aiModelId },
      });
      if (!model?.isActive || !model.supportsPdf) {
        throw new ValidationError(
          'Choose an active model that supports PDF files',
        );
      }
    }
    const data = {
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.aiModelId !== undefined && { aiModelId: input.aiModelId }),
      ...(input.useFallbacks !== undefined && {
        useFallbacks: input.useFallbacks,
      }),
      updatedById: actorId,
    };
    const row = await this.prisma.aiFeature.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
      include,
    });
    return this.map(row);
  }

  private async map(
    row: Awaited<
      ReturnType<PrismaService['aiFeature']['findUniqueOrThrow']>
    > & {
      aiModel: Parameters<AiModelsService['map']>[0] | null;
      updatedBy: { name: string } | null;
    },
  ): Promise<AiFeature> {
    let usable = false;
    if (row.enabled) {
      try {
        usable =
          (await this.aiModels.pdfCandidates({ feature: row.key })).length > 0;
      } catch (error) {
        if (!(error instanceof NoUsableAiModelError)) throw error;
      }
    }
    return {
      key: row.key,
      enabled: row.enabled,
      aiModel: row.aiModel ? this.aiModels.map(row.aiModel) : undefined,
      useFallbacks: row.useFallbacks,
      usable,
      updatedByName: row.updatedBy?.name,
      updatedAt: row.updatedAt,
    };
  }
}
