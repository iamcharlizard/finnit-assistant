-- Movements read from screenshots of a bank app, and the "en proceso"
-- state (shown by the bank, not applied yet: counts, but is marked).
-- Additive: a new table, two boolean columns with a default, a nullable
-- link and a new AI feature key (its settings row is in the next file).
-- Rollback: ../../../scripts/rollbacks/20261111090000_screenshot_imports.sql (covers both)
BEGIN;
-- AlterEnum
ALTER TYPE "AiFeatureKey" ADD VALUE IF NOT EXISTS 'screenshot_parsing';

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "inProcess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "screenshotImportId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "inProcess" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ScreenshotImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'uploaded',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "route" "ReceiptRoute",
    "accountHint" TEXT,
    "last4" VARCHAR(4),
    "accountId" TEXT,
    "ocrText" TEXT,
    "rawExtraction" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenshotImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreenshotImport_fileKey_key" ON "ScreenshotImport"("fileKey");

-- CreateIndex
CREATE INDEX "ScreenshotImport_userId_createdAt_idx" ON "ScreenshotImport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScreenshotImport_accountId_idx" ON "ScreenshotImport"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenshotImport_userId_fileHash_key" ON "ScreenshotImport"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "ImportedTransaction_screenshotImportId_idx" ON "ImportedTransaction"("screenshotImportId");

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_screenshotImportId_fkey" FOREIGN KEY ("screenshotImportId") REFERENCES "ScreenshotImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotImport" ADD CONSTRAINT "ScreenshotImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenshotImport" ADD CONSTRAINT "ScreenshotImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
