import { AiFeatureKey } from '@finnit/database';

export interface AiFeatureDefaults {
  enabled: boolean;
  useFallbacks: boolean;
  /** The feature sends PDF files, so its models need PDF support. */
  needsPdf: boolean;
}

/**
 * Settings a feature starts with when it has no AiFeature row yet (the
 * seed migrations insert the same values).
 */
export const AI_FEATURE_DEFAULTS: Record<AiFeatureKey, AiFeatureDefaults> = {
  statement_parsing: { enabled: true, useFallbacks: true, needsPdf: true },
  transaction_categorization: {
    enabled: true,
    useFallbacks: true,
    needsPdf: false,
  },
  recurring_classification: {
    enabled: true,
    useFallbacks: true,
    needsPdf: false,
  },
  // Sends the OCR text of the photo, not a file.
  receipt_parsing: { enabled: false, useFallbacks: true, needsPdf: false },
  translation: { enabled: true, useFallbacks: true, needsPdf: false },
};
