-- Attachments stored in the private S3 bucket (fileKey) instead of external URLs.
-- Rollback: ../../../scripts/rollbacks/20261013120000_private_attachments.sql
BEGIN;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "fileName" TEXT,
ALTER COLUMN "fileUrl" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_fileKey_key" ON "Attachment"("fileKey");


COMMIT;
