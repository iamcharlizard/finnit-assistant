-- Rollback for migration 20261013120000_private_attachments
-- DATA LOSS: attachments stored in S3 (no fileUrl) are deleted from the table;
-- delete their objects from the bucket separately (users/<userId>/attachments/).
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261013120000_private_attachments.sql

BEGIN;
DELETE FROM "Attachment" WHERE "fileUrl" IS NULL;
DROP INDEX IF EXISTS "Attachment_fileKey_key";
ALTER TABLE "Attachment" DROP COLUMN "fileKey", DROP COLUMN "fileName", ALTER COLUMN "fileUrl" SET NOT NULL;
DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261013120000_private_attachments';
COMMIT;
