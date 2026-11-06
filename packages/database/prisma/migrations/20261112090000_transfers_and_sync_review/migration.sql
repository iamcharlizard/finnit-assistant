-- Transfers between own accounts and reviewing synced movements. Additive:
--   Transaction.originalType: the type a movement had before it was turned
--     into a transfer side (restored when the conversion is undone).
--   Transfer.convertedAt: the transfer came from such a conversion.
--   TransferSuggestion: synced movements that look like a transfer between
--     the user's own accounts, waiting for the user to confirm.
--   MerchantAlias.transferAccountId: "these go to my account X".
--   NotificationType gains uncategorized (not used by this migration).
-- Rollback: ../../../scripts/rollbacks/20261112090000_transfers_and_sync_review.sql
BEGIN;
-- CreateEnum
CREATE TYPE "TransferSuggestionReason" AS ENUM ('pair', 'text', 'rule');

-- CreateEnum
CREATE TYPE "TransferSuggestionStatus" AS ENUM ('pending', 'accepted', 'dismissed');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'uncategorized';

-- AlterTable
ALTER TABLE "MerchantAlias" ADD COLUMN     "transferAccountId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "originalType" "TransactionType";

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "convertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TransferSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "counterpartTransactionId" TEXT,
    "counterpartAccountId" TEXT,
    "reason" "TransferSuggestionReason" NOT NULL,
    "status" "TransferSuggestionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferSuggestion_transactionId_key" ON "TransferSuggestion"("transactionId");

-- CreateIndex
CREATE INDEX "TransferSuggestion_userId_status_idx" ON "TransferSuggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "TransferSuggestion_counterpartTransactionId_idx" ON "TransferSuggestion"("counterpartTransactionId");

-- CreateIndex
CREATE INDEX "TransferSuggestion_counterpartAccountId_idx" ON "TransferSuggestion"("counterpartAccountId");

-- CreateIndex
CREATE INDEX "MerchantAlias_transferAccountId_idx" ON "MerchantAlias"("transferAccountId");

-- AddForeignKey
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferSuggestion" ADD CONSTRAINT "TransferSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferSuggestion" ADD CONSTRAINT "TransferSuggestion_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferSuggestion" ADD CONSTRAINT "TransferSuggestion_counterpartTransactionId_fkey" FOREIGN KEY ("counterpartTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferSuggestion" ADD CONSTRAINT "TransferSuggestion_counterpartAccountId_fkey" FOREIGN KEY ("counterpartAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
