-- Recurring expenses, card statement imports and reconciliation.
-- Also drops the one-transaction-per-account-per-day unique index.
-- Rollback: ../../../scripts/rollbacks/20261012120000_recurring_expenses_and_statements.sql
-- Single transaction: if any statement fails, nothing is applied.
BEGIN;

-- CreateEnum
CREATE TYPE "RecurringExpenseKind" AS ENUM ('subscription', 'utility', 'loan', 'installment', 'insurance', 'housing', 'membership', 'other');

-- CreateEnum
CREATE TYPE "RecurringTrackingMode" AS ENUM ('automatic', 'manual', 'reminder');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('upcoming', 'paid', 'skipped', 'missed');

-- CreateEnum
CREATE TYPE "OccurrenceMatchSource" AS ENUM ('manual', 'statement', 'bank');

-- CreateEnum
CREATE TYPE "StatementSource" AS ENUM ('pdf', 'belvo');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('uploaded', 'processing', 'needs_review', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "ImportedLineKind" AS ENUM ('charge', 'payment', 'refund', 'fee', 'interest', 'installment');

-- CreateEnum
CREATE TYPE "ImportedLineStatus" AS ENUM ('pending', 'matched', 'created', 'ignored');


-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE IF NOT EXISTS 'statement';

-- DropForeignKey
ALTER TABLE "RecurringRule" DROP CONSTRAINT "RecurringRule_defaultAccountId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringRule" DROP CONSTRAINT "RecurringRule_defaultCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "RecurringRule" DROP CONSTRAINT "RecurringRule_userId_fkey";

-- DropIndex
DROP INDEX "Transaction_userId_accountId_txnDate_key";

-- AlterTable
ALTER TABLE "BankConnection" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ImportedTransaction" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "installmentNumber" SMALLINT,
ADD COLUMN     "installmentTotal" SMALLINT,
ADD COLUMN     "kind" "ImportedLineKind" NOT NULL DEFAULT 'charge',
ADD COLUMN     "matchedOccurrenceId" TEXT,
ADD COLUMN     "postDate" DATE,
ADD COLUMN     "statementImportId" TEXT,
ADD COLUMN     "status" "ImportedLineStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "suggestedCategoryId" TEXT,
ALTER COLUMN "linkedAccountId" DROP NOT NULL,
ALTER COLUMN "providerTxnId" DROP NOT NULL;

-- Backfill accountId of existing bank lines from their linked account
UPDATE "ImportedTransaction" it SET "accountId" = la."accountId"
FROM "LinkedAccount" la WHERE la."id" = it."linkedAccountId";
ALTER TABLE "ImportedTransaction" ALTER COLUMN "accountId" SET NOT NULL;

-- DropTable (RecurringRule had no API and no data; replaced by RecurringExpense)
DROP TABLE "RecurringRule";

-- Recreate RecurringFrequency: its only user was RecurringRule
DROP TYPE "RecurringFrequency";
CREATE TYPE "RecurringFrequency" AS ENUM ('weekly', 'biweekly', 'semimonthly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'yearly');

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RecurringExpenseKind" NOT NULL,
    "trackingMode" "RecurringTrackingMode" NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "interval" SMALLINT NOT NULL DEFAULT 1,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "amount" DECIMAL(18,2) NOT NULL,
    "isVariableAmount" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(3) NOT NULL,
    "accountId" TEXT,
    "categoryId" TEXT,
    "debtId" TEXT,
    "merchantPattern" TEXT,
    "installmentsTotal" SMALLINT,
    "installmentsPaid" SMALLINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "nextDueDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOccurrence" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "expectedAmount" DECIMAL(18,2) NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'upcoming',
    "transactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "matchedBy" "OccurrenceMatchSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" "StatementSource" NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'uploaded',
    "parser" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,
    "statementDate" DATE,
    "paymentDueDate" DATE,
    "previousBalance" DECIMAL(18,2),
    "totalCharges" DECIMAL(18,2),
    "totalCredits" DECIMAL(18,2),
    "statementBalance" DECIMAL(18,2),
    "noInterestPayment" DECIMAL(18,2),
    "minimumPayment" DECIMAL(18,2),
    "currency" VARCHAR(3) NOT NULL,
    "fileKey" TEXT,
    "fileHash" TEXT,
    "computedTotal" DECIMAL(18,2),
    "difference" DECIMAL(18,2),
    "errorMessage" TEXT,
    "rawExtraction" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpense_debtId_key" ON "RecurringExpense"("debtId");

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_active_idx" ON "RecurringExpense"("userId", "active");

-- CreateIndex
CREATE INDEX "RecurringExpense_accountId_idx" ON "RecurringExpense"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringExpense_userId_name_key" ON "RecurringExpense"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_transactionId_key" ON "RecurringOccurrence"("transactionId");

-- CreateIndex
CREATE INDEX "RecurringOccurrence_status_dueDate_idx" ON "RecurringOccurrence"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_recurringExpenseId_dueDate_key" ON "RecurringOccurrence"("recurringExpenseId", "dueDate");

-- CreateIndex
CREATE INDEX "StatementImport_userId_createdAt_idx" ON "StatementImport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StatementImport_accountId_periodEnd_key" ON "StatementImport"("accountId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "StatementImport_userId_fileHash_key" ON "StatementImport"("userId", "fileHash");

-- CreateIndex
CREATE INDEX "ImportedTransaction_statementImportId_idx" ON "ImportedTransaction"("statementImportId");

-- CreateIndex
CREATE INDEX "ImportedTransaction_accountId_date_idx" ON "ImportedTransaction"("accountId", "date");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementImport" ADD CONSTRAINT "StatementImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_statementImportId_fkey" FOREIGN KEY ("statementImportId") REFERENCES "StatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedTransaction" ADD CONSTRAINT "ImportedTransaction_matchedOccurrenceId_fkey" FOREIGN KEY ("matchedOccurrenceId") REFERENCES "RecurringOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
