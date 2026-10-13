-- Settings rows for the AI feature keys added by
-- 20261015090000_category_i18n_and_ai_features. Separate migration because
-- a new enum value can't be used in the transaction that added it.
-- Receipt parsing starts off; the rest start on, with fallbacks.
-- Rollback: ../../../scripts/rollbacks/20261015090000_category_i18n_and_ai_features.sql (covers both)
BEGIN;

INSERT INTO "AiFeature" ("key", "enabled", "useFallbacks", "updatedAt")
VALUES
  ('transaction_categorization', true, true, CURRENT_TIMESTAMP),
  ('recurring_classification', true, true, CURRENT_TIMESTAMP),
  ('receipt_parsing', false, true, CURRENT_TIMESTAMP),
  ('translation', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

COMMIT;
