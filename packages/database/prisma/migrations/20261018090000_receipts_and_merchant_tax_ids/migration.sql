-- Receipt photos (feature 14): ReceiptImport drafts and the merchant tax ID
-- (RFC) → name → category table that learns from confirmations.
-- Additive only: three enums and two new tables; no existing rows change.
-- MerchantTaxId rows with userId NULL are global: Postgres treats NULLs as
-- distinct in the (userId, taxId) unique index, so a partial unique index
-- keeps one global row per taxId.
-- Rollback: ../../../scripts/rollbacks/20261018090000_receipts_and_merchant_tax_ids.sql
BEGIN;
-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('uploaded', 'processing', 'needs_review', 'confirmed', 'discarded', 'failed');

-- CreateEnum
CREATE TYPE "ReceiptRoute" AS ENUM ('cfdi_qr', 'ocr_rules', 'ai');

-- CreateEnum
CREATE TYPE "ReceiptConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "ReceiptImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'uploaded',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "route" "ReceiptRoute",
    "confidence" "ReceiptConfidence",
    "total" DECIMAL(18,2),
    "subtotal" DECIMAL(18,2),
    "tax" DECIMAL(18,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MXN',
    "date" DATE,
    "merchantName" TEXT,
    "merchantTaxId" VARCHAR(13),
    "cardLast4" VARCHAR(4),
    "suggestedAccountId" TEXT,
    "suggestedCategoryId" TEXT,
    "cfdiUuid" VARCHAR(36),
    "ocrText" TEXT,
    "rawExtraction" JSONB,
    "errorMessage" TEXT,
    "transactionId" TEXT,
    "matchedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantTaxId" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taxId" VARCHAR(13) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "categoryId" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantTaxId_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptImport_fileKey_key" ON "ReceiptImport"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptImport_transactionId_key" ON "ReceiptImport"("transactionId");

-- CreateIndex
CREATE INDEX "ReceiptImport_userId_createdAt_idx" ON "ReceiptImport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReceiptImport_suggestedAccountId_idx" ON "ReceiptImport"("suggestedAccountId");

-- CreateIndex
CREATE INDEX "ReceiptImport_suggestedCategoryId_idx" ON "ReceiptImport"("suggestedCategoryId");

-- CreateIndex
CREATE INDEX "ReceiptImport_matchedTransactionId_idx" ON "ReceiptImport"("matchedTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptImport_userId_fileHash_key" ON "ReceiptImport"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "MerchantTaxId_taxId_idx" ON "MerchantTaxId"("taxId");

-- CreateIndex
CREATE INDEX "MerchantTaxId_categoryId_idx" ON "MerchantTaxId"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantTaxId_userId_taxId_key" ON "MerchantTaxId"("userId", "taxId");

-- AddForeignKey
ALTER TABLE "ReceiptImport" ADD CONSTRAINT "ReceiptImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptImport" ADD CONSTRAINT "ReceiptImport_suggestedAccountId_fkey" FOREIGN KEY ("suggestedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptImport" ADD CONSTRAINT "ReceiptImport_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptImport" ADD CONSTRAINT "ReceiptImport_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptImport" ADD CONSTRAINT "ReceiptImport_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantTaxId" ADD CONSTRAINT "MerchantTaxId_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantTaxId" ADD CONSTRAINT "MerchantTaxId_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One global entry per tax ID (userId NULL).
CREATE UNIQUE INDEX "MerchantTaxId_global_taxId_key" ON "MerchantTaxId"("taxId") WHERE "userId" IS NULL;

-- Global seed: only well-known, publicly documented issuer RFCs.
INSERT INTO "MerchantTaxId" ("id", "userId", "taxId", "name", "hits", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, NULL, 'CCO8605231N4', 'OXXO', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, NULL, 'NWM9709244W4', 'Walmart', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

COMMIT;
