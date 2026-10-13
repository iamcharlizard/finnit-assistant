/** Admin panel, AI: GraphQL documents, types and labels. */

export type AiProvider = 'anthropic' | 'openai' | 'google';
export type AiFeatureKey = 'statement_parsing';

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

/** The web's name and explanation of each AI feature. */
export const AI_FEATURE_COPY: Record<
  AiFeatureKey,
  { label: string; description: string }
> = {
  statement_parsing: {
    label: 'Leer estados de cuenta en PDF',
    description:
      'Para bancos sin lector propio (hoy todos menos Banamex), el PDF se envía al modelo de IA.',
  },
};

/** Select value for "use the catalog default" (Radix Select can't use ""). */
export const DEFAULT_MODEL_VALUE = 'default';
