-- Settings row for the alias_pattern AI feature added by
-- 20261114090000_alias_pattern_ai. On by default: it only runs when the
-- user asks for a suggested pattern.
-- Rollback: ../../../scripts/rollbacks/20261114090000_alias_pattern_ai.sql (covers both)
BEGIN;
INSERT INTO "AiFeature" ("key", "enabled", "useFallbacks", "updatedAt")
VALUES ('alias_pattern', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
COMMIT;
