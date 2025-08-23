-- Rollback Script for Finnit Database Schema
-- This script provides rollback procedures for critical schema changes
-- Run these commands in reverse order if you need to rollback the database

-- WARNING: This will delete ALL data in the database!
-- Only use in development or when explicitly required

-- Drop foreign key constraints first to avoid dependency issues
ALTER TABLE "public"."TransactionTag" DROP CONSTRAINT IF EXISTS "TransactionTag_transactionId_fkey";
ALTER TABLE "public"."TransactionTag" DROP CONSTRAINT IF EXISTS "TransactionTag_tagId_fkey";
ALTER TABLE "public"."Tag" DROP CONSTRAINT IF EXISTS "Tag_userId_fkey";
ALTER TABLE "public"."ReconciliationItem" DROP CONSTRAINT IF EXISTS "ReconciliationItem_sessionId_fkey";
ALTER TABLE "public"."ReconciliationItem" DROP CONSTRAINT IF EXISTS "ReconciliationItem_accountId_fkey";
ALTER TABLE "public"."ReconciliationSession" DROP CONSTRAINT IF EXISTS "ReconciliationSession_userId_fkey";
ALTER TABLE "public"."ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_linkedAccountId_fkey";
ALTER TABLE "public"."ImportedTransaction" DROP CONSTRAINT IF EXISTS "ImportedTransaction_matchedTransactionId_fkey";
ALTER TABLE "public"."LinkedAccount" DROP CONSTRAINT IF EXISTS "LinkedAccount_bankConnectionId_fkey";
ALTER TABLE "public"."LinkedAccount" DROP CONSTRAINT IF EXISTS "LinkedAccount_accountId_fkey";
ALTER TABLE "public"."BankConnection" DROP CONSTRAINT IF EXISTS "BankConnection_userId_fkey";
ALTER TABLE "public"."Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "public"."DebtPayment" DROP CONSTRAINT IF EXISTS "DebtPayment_debtId_fkey";
ALTER TABLE "public"."DebtPayment" DROP CONSTRAINT IF EXISTS "DebtPayment_transactionId_fkey";
ALTER TABLE "public"."Debt" DROP CONSTRAINT IF EXISTS "Debt_userId_fkey";
ALTER TABLE "public"."Debt" DROP CONSTRAINT IF EXISTS "Debt_linkedAccountId_fkey";
ALTER TABLE "public"."GoalContribution" DROP CONSTRAINT IF EXISTS "GoalContribution_goalId_fkey";
ALTER TABLE "public"."GoalContribution" DROP CONSTRAINT IF EXISTS "GoalContribution_transactionId_fkey";
ALTER TABLE "public"."Goal" DROP CONSTRAINT IF EXISTS "Goal_userId_fkey";
ALTER TABLE "public"."BUDGET_CATEGORY" DROP CONSTRAINT IF EXISTS "BUDGET_CATEGORY_budgetId_fkey";
ALTER TABLE "public"."BUDGET_CATEGORY" DROP CONSTRAINT IF EXISTS "BUDGET_CATEGORY_categoryId_fkey";
ALTER TABLE "public"."Budget" DROP CONSTRAINT IF EXISTS "Budget_userId_fkey";
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT IF EXISTS "RecurringRule_userId_fkey";
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT IF EXISTS "RecurringRule_defaultAccountId_fkey";
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT IF EXISTS "RecurringRule_defaultCategoryId_fkey";
ALTER TABLE "public"."Attachment" DROP CONSTRAINT IF EXISTS "Attachment_transactionId_fkey";
ALTER TABLE "public"."Transfer" DROP CONSTRAINT IF EXISTS "Transfer_fromTxnId_fkey";
ALTER TABLE "public"."Transfer" DROP CONSTRAINT IF EXISTS "Transfer_toTxnId_fkey";
ALTER TABLE "public"."Transaction" DROP CONSTRAINT IF EXISTS "Transaction_userId_fkey";
ALTER TABLE "public"."Transaction" DROP CONSTRAINT IF EXISTS "Transaction_accountId_fkey";
ALTER TABLE "public"."Transaction" DROP CONSTRAINT IF EXISTS "Transaction_categoryId_fkey";
ALTER TABLE "public"."Category" DROP CONSTRAINT IF EXISTS "Category_userId_fkey";
ALTER TABLE "public"."Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";
ALTER TABLE "public"."CreditCardTerms" DROP CONSTRAINT IF EXISTS "CreditCardTerms_accountId_fkey";
ALTER TABLE "public"."Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "public"."TransactionTag";
DROP TABLE IF EXISTS "public"."Tag";
DROP TABLE IF EXISTS "public"."ReconciliationItem";
DROP TABLE IF EXISTS "public"."ReconciliationSession";
DROP TABLE IF EXISTS "public"."ImportedTransaction";
DROP TABLE IF EXISTS "public"."LinkedAccount";
DROP TABLE IF EXISTS "public"."BankConnection";
DROP TABLE IF EXISTS "public"."Notification";
DROP TABLE IF EXISTS "public"."DebtPayment";
DROP TABLE IF EXISTS "public"."Debt";
DROP TABLE IF EXISTS "public"."GoalContribution";
DROP TABLE IF EXISTS "public"."Goal";
DROP TABLE IF EXISTS "public"."BUDGET_CATEGORY";
DROP TABLE IF EXISTS "public"."Budget";
DROP TABLE IF EXISTS "public"."RecurringRule";
DROP TABLE IF EXISTS "public"."Attachment";
DROP TABLE IF EXISTS "public"."Transfer";
DROP TABLE IF EXISTS "public"."Transaction";
DROP TABLE IF EXISTS "public"."Category";
DROP TABLE IF EXISTS "public"."CreditCardTerms";
DROP TABLE IF EXISTS "public"."Account";
DROP TABLE IF EXISTS "public"."User";

-- Drop enums
DROP TYPE IF EXISTS "public"."RecurringFrequency";
DROP TYPE IF EXISTS "public"."DebtKind";
DROP TYPE IF EXISTS "public"."ReconciliationState";
DROP TYPE IF EXISTS "public"."ReconciliationItemType";
DROP TYPE IF EXISTS "public"."BankConnectionStatus";
DROP TYPE IF EXISTS "public"."BankProvider";
DROP TYPE IF EXISTS "public"."NotificationStatus";
DROP TYPE IF EXISTS "public"."NotificationType";
DROP TYPE IF EXISTS "public"."TransactionSource";
DROP TYPE IF EXISTS "public"."TransactionType";
DROP TYPE IF EXISTS "public"."AccountType";

-- Note: After running this rollback, you'll need to run:
-- prisma migrate reset --force
-- OR
-- prisma db push --force-reset
-- to completely reset the database schema