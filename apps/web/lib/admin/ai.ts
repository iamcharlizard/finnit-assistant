import type { Translate } from '@/lib/i18n/translator';

/** Admin panel, AI: GraphQL documents, types and labels. */

export type AiProvider = 'anthropic' | 'openai' | 'google';

/** The features the web knows by name; the API may add others. */
export const KNOWN_AI_FEATURES = [
  'statement_parsing',
  'transaction_categorization',
  'recurring_classification',
  'receipt_parsing',
  'translation',
] as const;
export type KnownAiFeatureKey = (typeof KNOWN_AI_FEATURES)[number];
export type AiFeatureKey = KnownAiFeatureKey | (string & {});

export interface AiModel {
  id: string;
  provider: AiProvider;
  modelId: string;
  label: string;
  isActive: boolean;
  isDefault: boolean;
  supportsPdf: boolean;
  sortOrder: number;
  providerConfigured: boolean;
  usable: boolean;
}

export interface AiFeature {
  key: AiFeatureKey;
  enabled: boolean;
  useFallbacks: boolean;
  usable: boolean;
  updatedAt: string;
  updatedByName: string | null;
  aiModel: Pick<AiModel, 'id' | 'label'> | null;
}

const MODEL_FIELDS =
  'id provider modelId label isActive isDefault supportsPdf sortOrder providerConfigured usable';
const FEATURE_FIELDS =
  'key enabled useFallbacks usable updatedAt updatedByName aiModel { id label }';

export const AI_SETTINGS_QUERY = `query AiSettings {
  aiFeatures { ${FEATURE_FIELDS} }
  aiModels { ${MODEL_FIELDS} }
}`;

export const UPDATE_AI_FEATURE_MUTATION = `mutation UpdateAiFeature($key: AiFeatureKey!, $input: UpdateAiFeatureInput!) {
  updateAiFeature(key: $key, input: $input) { ${FEATURE_FIELDS} }
}`;

export const CREATE_AI_MODEL_MUTATION = `mutation CreateAiModel($input: CreateAiModelInput!) { createAiModel(input: $input) { id } }`;

export const UPDATE_AI_MODEL_MUTATION = `mutation UpdateAiModel($id: ID!, $input: UpdateAiModelInput!) { updateAiModel(id: $id, input: $input) { id } }`;

export const DELETE_AI_MODEL_MUTATION = `mutation DeleteAiModel($id: ID!) { deleteAiModel(id: $id) }`;

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Gemini',
};

export function isKnownAiFeature(key: string): key is KnownAiFeatureKey {
  return (KNOWN_AI_FEATURES as readonly string[]).includes(key);
}

/**
 * The web's name and explanation of an AI feature. A key the web doesn't
 * know yet still shows, by its raw name and without a description.
 */
export function aiFeatureCopy(
  key: AiFeatureKey,
  t: Translate,
): { label: string; description: string } {
  if (!isKnownAiFeature(key)) return { label: key, description: '' };
  return {
    label: t(`admin.ai.features.${key}.label`),
    description: t(`admin.ai.features.${key}.description`),
  };
}

/** Features that send PDFs to the model: they may only pick PDF models. */
export function needsPdfModel(key: AiFeatureKey): boolean {
  return key === 'statement_parsing';
}

/** Select value for "use the catalog default" (Radix Select can't use ""). */
export const DEFAULT_MODEL_VALUE = 'default';
