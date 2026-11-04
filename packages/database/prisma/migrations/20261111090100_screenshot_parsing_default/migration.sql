-- Settings row for the screenshot_parsing AI feature added by
-- 20261111090000_screenshot_imports (a new enum value can't be used in the
-- transaction that added it). Off by default, like receipt parsing.
-- Rollback: ../../../scripts/rollbacks/20261111090000_screenshot_imports.sql (covers both)
BEGIN;
INSERT INTO "AiFeature" ("key", "enabled", "useFallbacks", "updatedAt")
VALUES ('screenshot_parsing', false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
COMMIT;
