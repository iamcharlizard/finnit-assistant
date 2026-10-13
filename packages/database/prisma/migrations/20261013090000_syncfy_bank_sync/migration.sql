-- Syncfy bank aggregation: provider users, credential sync state, linked
-- account balances and the 'deposit' line kind. Bank logins stay at Syncfy.
-- Rollback: ../../../scripts/rollbacks/20261013090000_syncfy_bank_sync.sql
BEGIN;

-- AlterEnum
ALTER TYPE "BankProvider" ADD VALUE IF NOT EXISTS 'syncfy';

-- AlterEnum
ALTER TYPE "ImportedLineKind" ADD VALUE IF NOT EXISTS 'deposit';

-- DropForeignKey
ALTER TABLE "LinkedAccount" DROP CONSTRAINT "LinkedAccount_accountId_fkey";

-- AlterTable
ALTER TABLE "BankConnection" ADD COLUMN     "lastPullRequestedAt" TIMESTAMP(3),
ADD COLUMN     "lastStatusCode" INTEGER,
ADD COLUMN     "providerUserId" TEXT,
ADD COLUMN     "transactionsCursor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LinkedAccount" ADD COLUMN     "availableCredit" DECIMAL(18,2),
ADD COLUMN     "balance" DECIMAL(18,2),
ADD COLUMN     "balanceUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "creditLimit" DECIMAL(18,2),
ALTER COLUMN "accountId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BankProviderUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BankProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankProviderUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankProviderUser_provider_userId_key" ON "BankProviderUser"("provider", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankProviderUser_provider_providerUserId_key" ON "BankProviderUser"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "BankConnection_userId_idx" ON "BankConnection"("userId");

-- AddForeignKey
ALTER TABLE "BankProviderUser" ADD CONSTRAINT "BankProviderUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;


COMMIT;
