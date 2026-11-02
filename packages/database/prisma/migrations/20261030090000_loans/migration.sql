-- Loans: types (institutional, personal, purchase financing), terms (payment
-- frequency, installments, total to repay), charges that add to a debt, and
-- payments made before the debt was registered (no transaction).
-- Additive and backwards-compatible: new enums, nullable/defaulted columns,
-- a new table, and DebtPayment.transactionId becomes optional.
-- Rollback: ../../../scripts/rollbacks/20261030090000_loans.sql
BEGIN;
-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('institutional', 'personal', 'purchase_financing');

-- CreateEnum
CREATE TYPE "LoanInterestMode" AS ENUM ('rate', 'total_amount', 'installment_amount');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('active', 'paid_off');

-- CreateEnum
CREATE TYPE "DebtChargeDestination" AS ENUM ('deposit', 'purchase');

-- AlterTable
ALTER TABLE "RecurringSuggestionState" ADD COLUMN     "aiLenderName" TEXT,
ADD COLUMN     "aiLoanType" "LoanType",
ADD COLUMN     "loanClassifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "destination" "DebtChargeDestination",
ADD COLUMN     "disbursementTransactionId" TEXT,
ADD COLUMN     "includesVat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "installmentAmount" DECIMAL(18,2),
ADD COLUMN     "installmentsTotal" SMALLINT,
ADD COLUMN     "interestMode" "LoanInterestMode",
ADD COLUMN     "lenderName" TEXT,
ADD COLUMN     "loanType" "LoanType",
ADD COLUMN     "paymentFrequency" "RecurringFrequency",
ADD COLUMN     "status" "DebtStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "totalToRepay" DECIMAL(18,2),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DebtPayment" ADD COLUMN     "isHistorical" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "transactionId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DebtCharge" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "principal" DECIMAL(18,2) NOT NULL,
    "totalToRepay" DECIMAL(18,2) NOT NULL,
    "installments" SMALLINT,
    "destination" "DebtChargeDestination" NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebtCharge_transactionId_key" ON "DebtCharge"("transactionId");

-- CreateIndex
CREATE INDEX "DebtCharge_debtId_date_idx" ON "DebtCharge"("debtId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_disbursementTransactionId_key" ON "Debt"("disbursementTransactionId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_disbursementTransactionId_fkey" FOREIGN KEY ("disbursementTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtCharge" ADD CONSTRAINT "DebtCharge_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtCharge" ADD CONSTRAINT "DebtCharge_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;


COMMIT;
