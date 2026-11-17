-- "Análisis" of Pagos recurrentes: the AI classifies each recurring expense
-- as essential, reducible or dispensable from the user's answers to a short
-- questionnaire (RecurringEssentialProfile). The AI feature's settings row
-- is inserted by 20261125090100_recurring_essentials_default (a new enum
-- value can't be used in the transaction that added it).
-- Rollback: ../../../scripts/rollbacks/20261125090000_recurring_essentials.sql (covers both)
ALTER TYPE "AiFeatureKey" ADD VALUE IF NOT EXISTS 'recurring_essentials';

BEGIN;
CREATE TYPE "EssentialLevel" AS ENUM ('essential', 'reducible', 'dispensable');

ALTER TABLE "RecurringExpense"
  ADD COLUMN "essentialLevel" "EssentialLevel",
  ADD COLUMN "essentialReason" VARCHAR(300),
  ADD COLUMN "essentialAt" TIMESTAMP(3);

CREATE TABLE "RecurringEssentialProfile" (
  "userId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringEssentialProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "RecurringEssentialProfile"
  ADD CONSTRAINT "RecurringEssentialProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
