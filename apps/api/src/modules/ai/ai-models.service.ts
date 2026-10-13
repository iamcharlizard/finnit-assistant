import { Injectable, Logger } from '@nestjs/common';
import {
  AiFeatureKey,
  AiProvider,
  Prisma,
  type AiModel as AiModelRow,
} from '@finnit/database';
import { PrismaService } from '../../services/prisma.service';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/exceptions/graphql-error.exception';
import {
  AiModel,
  AiModelsArgs,
  CreateAiModelInput,
  UpdateAiModelInput,
} from './dto/ai-model.dto';
import {
  AiProviderClient,
  AiProviderError,
  PdfExtractionRequest,
} from './providers/ai-provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GoogleProvider } from './providers/google.provider';
import { OpenAiProvider } from './providers/openai.provider';

/** Injection token for the provider clients (tests replace them). */
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');

export function defaultProviders(): AiProviderClient[] {
  return [new AnthropicProvider(), new OpenAiProvider(), new GoogleProvider()];
}

export interface PdfExtractionResult {
  model: AiModelRow;
  data: unknown;
}

export class NoUsableAiModelError extends Error {}

/** The admin turned the AI feature off. */
export class AiFeatureDisabledError extends NoUsableAiModelError {
  constructor(feature: AiFeatureKey) {
    super(`The AI feature "${feature}" is turned off by an administrator`);
  }
}

export interface PdfCandidateOptions {
  /** A specific model (e.g. reprocessing a statement); it must be usable. */
  aiModelId?: string;
  /** Applies that feature's admin settings (on/off, model, fallbacks). */
  feature?: AiFeatureKey;
}

/**
 * Catalog of AI models and the entry point for calling them. A model is
 * used only when it is active AND its provider's API key is configured;
 * disabled models are never called, not even by id.
 */
@Injectable()
export class AiModelsService {
  private readonly logger = new Logger(AiModelsService.name);
  private readonly providers: Map<AiProvider, AiProviderClient>;

  constructor(
    private readonly prisma: PrismaService,
    providers: AiProviderClient[] = defaultProviders(),
  ) {
    this.providers = new Map(providers.map((p) => [p.provider, p]));
  }

  async list(args: AiModelsArgs = {}): Promise<AiModel[]> {
    const rows = await this.prisma.aiModel.findMany({
      where: {
        ...(args.activeOnly && { isActive: true }),
        ...(args.provider && { provider: args.provider }),
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
    return rows.map((row) => this.map(row));
  }

  async create(input: CreateAiModelInput): Promise<AiModel> {
    const modelId = input.modelId.trim();
    if (!modelId || !input.label.trim()) {
      throw new ValidationError('Model id and label are required');
    }
    if (input.isDefault && !input.isActive) {
      throw new ValidationError('The default model must be active');
    }
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault) await this.clearDefault(tx);
        return tx.aiModel.create({
          data: {
            provider: input.provider,
            modelId,
            label: input.label.trim(),
            isActive: input.isActive ?? false,
            isDefault: input.isDefault ?? false,
            supportsPdf: input.supportsPdf ?? false,
            sortOrder: input.sortOrder ?? 100,
          },
        });
      });
      return this.map(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictError('This model is already in the catalog');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateAiModelInput): Promise<AiModel> {
    const current = await this.getRow(id);
    const isActive = input.isActive ?? current.isActive;
    let isDefault = input.isDefault ?? current.isDefault;

    if (input.isDefault && !isActive) {
      throw new ValidationError('The default model must be active');
    }
    // Deactivating the default also removes it as default.
    if (!isActive) isDefault = false;

    const row = await this.prisma.$transaction(async (tx) => {
      if (isDefault && !current.isDefault) await this.clearDefault(tx);
      return tx.aiModel.update({
        where: { id },
        data: {
          label: input.label?.trim() || undefined,
          isActive,
          isDefault,
          supportsPdf: input.supportsPdf,
          sortOrder: input.sortOrder,
        },
      });
    });
    return this.map(row);
  }

  async delete(id: string): Promise<boolean> {
    await this.getRow(id);
    await this.prisma.aiModel.delete({ where: { id } });
    return true;
  }

  /**
   * Models to try for a PDF, in order. Without options: active models with
   * PDF support whose provider is configured, default first, then by
   * sortOrder. With a feature: its own model first (if usable), then the
   * rest only when the feature allows fallbacks. With `aiModelId`, only
   * that model.
   */
  async pdfCandidates(
    options: PdfCandidateOptions = {},
  ): Promise<AiModelRow[]> {
    const { aiModelId, feature } = options;
    const settings = feature
      ? await this.prisma.aiFeature.findUnique({ where: { key: feature } })
      : null;
    if (feature && settings && !settings.enabled) {
      throw new AiFeatureDisabledError(feature);
    }

    const rows = await this.prisma.aiModel.findMany({
      where: {
        isActive: true,
        supportsPdf: true,
        ...(aiModelId && { id: aiModelId }),
      },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }],
    });
    const usable = rows.filter(
      (row) => this.providers.get(row.provider)?.isConfigured,
    );
    if (aiModelId || !settings) return usable;

    const own = usable.find((row) => row.id === settings.aiModelId);
    const rest = usable.filter((row) => row !== own);
    const first = own ?? (settings.aiModelId ? undefined : rest.shift());
    return [...(first ? [first] : []), ...(settings.useFallbacks ? rest : [])];
  }

  /**
   * Extracts structured data from a PDF with the first model that answers;
   * a failing model falls through to the next one.
   */
  async extractFromPdf(
    request: Omit<PdfExtractionRequest, 'modelId'>,
    options: PdfCandidateOptions = {},
  ): Promise<PdfExtractionResult> {
    const candidates = await this.pdfCandidates(options);
    if (candidates.length === 0) {
      throw new NoUsableAiModelError(
        options.aiModelId
          ? 'That AI model is not active or its provider is not configured'
          : 'No active AI model with PDF support has its provider configured',
      );
    }

    const failures: string[] = [];
    for (const model of candidates) {
      const provider = this.providers.get(model.provider)!;
      try {
        const data = await provider.extractFromPdf({
          ...request,
          modelId: model.modelId,
        });
        return { model, data };
      } catch (error) {
        const message =
          error instanceof AiProviderError
            ? error.message
            : `${model.provider}: ${(error as Error).message}`;
        this.logger.warn(`AI model ${model.modelId} failed: ${message}`);
        failures.push(`${model.label}: ${message}`);
      }
    }
    throw new AiProviderError(
      candidates[candidates.length - 1].provider,
      `every model failed (${failures.join('; ')})`,
    );
  }

  private async clearDefault(tx: Prisma.TransactionClient) {
    await tx.aiModel.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  private async getRow(id: string): Promise<AiModelRow> {
    const row = await this.prisma.aiModel.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('AI model not found');
    return row;
  }

  map(row: AiModelRow): AiModel {
    const providerConfigured = Boolean(
      this.providers.get(row.provider)?.isConfigured,
    );
    return {
      ...row,
      providerConfigured,
      usable: row.isActive && providerConfigured,
    };
  }
}
