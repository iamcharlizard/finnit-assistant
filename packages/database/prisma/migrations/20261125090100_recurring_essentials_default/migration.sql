-- Settings row for the recurring_essentials AI feature added by
-- 20261125090000_recurring_essentials. On by default: it only runs when the
-- user answers the questionnaire or asks to analyze again.
-- Rollback: ../../../scripts/rollbacks/20261125090000_recurring_essentials.sql (covers both)
BEGIN;
INSERT INTO "AiFeature" ("key", "enabled", "useFallbacks", "updatedAt")
VALUES ('recurring_essentials', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
COMMIT;
