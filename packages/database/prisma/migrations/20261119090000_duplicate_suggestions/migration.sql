-- Possible duplicates: two movements of one account that look like the same
-- money recorded twice (one by hand, one from the bank). Merging keeps the
-- bank's and deletes the other; "No es duplicado" stays as dismissed.
-- Rollback: ../../../scripts/rollbacks/20261119090000_duplicate_suggestions.sql
BEGIN;
-- CreateEnum
CREATE TYPE "DuplicateSuggestionStatus" AS ENUM ('pending', 'dismissed');

-- CreateTable
CREATE TABLE "DuplicateSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keepTxnId" TEXT NOT NULL,
    "dropTxnId" TEXT NOT NULL,
    "status" "DuplicateSuggestionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DuplicateSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuplicateSuggestion_userId_status_idx" ON "DuplicateSuggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "DuplicateSuggestion_dropTxnId_idx" ON "DuplicateSuggestion"("dropTxnId");

-- CreateIndex
CREATE UNIQUE INDEX "DuplicateSuggestion_keepTxnId_dropTxnId_key" ON "DuplicateSuggestion"("keepTxnId", "dropTxnId");

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_keepTxnId_fkey" FOREIGN KEY ("keepTxnId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuplicateSuggestion" ADD CONSTRAINT "DuplicateSuggestion_dropTxnId_fkey" FOREIGN KEY ("dropTxnId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
