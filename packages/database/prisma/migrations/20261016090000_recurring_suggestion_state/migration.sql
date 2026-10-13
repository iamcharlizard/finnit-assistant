-- State of detected recurring-payment suggestions (feature 15): dismissed,
-- accepted, or classified by AI (name, kind, category cached per suggestion).
-- Additive only: a new table, nothing existing changes.
-- Rollback: ../../../scripts/rollbacks/20261016090000_recurring_suggestion_state.sql
BEGIN;
-- CreateTable
CREATE TABLE "RecurringSuggestionState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "aiName" TEXT,
    "aiKind" "RecurringExpenseKind",
    "aiCategoryId" TEXT,
    "aiModel" TEXT,
    "classifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSuggestionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringSuggestionState_aiCategoryId_idx" ON "RecurringSuggestionState"("aiCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringSuggestionState_userId_fingerprint_key" ON "RecurringSuggestionState"("userId", "fingerprint");

-- AddForeignKey
ALTER TABLE "RecurringSuggestionState" ADD CONSTRAINT "RecurringSuggestionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSuggestionState" ADD CONSTRAINT "RecurringSuggestionState_aiCategoryId_fkey" FOREIGN KEY ("aiCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;


COMMIT;
