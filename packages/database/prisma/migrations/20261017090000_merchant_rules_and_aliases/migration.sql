-- Merchant aliases (feature 17) and merchant rules + category suggestions
-- (feature 16).
-- Additive only: two enums, two tables, nullable/defaulted Transaction
-- columns. Existing rows keep categorySource NULL (unknown: categorized
-- before the source was tracked); nothing is backfilled.
-- unaccent powers the case- and accent-insensitive alias matching; it is a
-- trusted extension (PG13+), so the database owner can create it.
-- Rollback: ../../../scripts/rollbacks/20261017090000_merchant_rules_and_aliases.sql
BEGIN;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('manual', 'rule', 'ai', 'bank');

-- CreateEnum
CREATE TYPE "AliasMatchType" AS ENUM ('contains', 'starts_with', 'exact', 'regex');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "aliasId" TEXT,
ADD COLUMN     "aliasName" TEXT,
ADD COLUMN     "categorySource" "CategorySource",
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedBy" "CategorySource",
ADD COLUMN     "suggestedCategoryId" TEXT;

-- CreateTable
CREATE TABLE "MerchantAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchType" "AliasMatchType" NOT NULL,
    "pattern" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "categoryId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pattern" VARCHAR(200) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantAlias_userId_active_idx" ON "MerchantAlias"("userId", "active");

-- CreateIndex
CREATE INDEX "MerchantAlias_categoryId_idx" ON "MerchantAlias"("categoryId");

-- CreateIndex
CREATE INDEX "MerchantRule_categoryId_idx" ON "MerchantRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantRule_userId_pattern_key" ON "MerchantRule"("userId", "pattern");

-- CreateIndex
CREATE INDEX "Transaction_aliasId_idx" ON "Transaction"("aliasId");

-- CreateIndex
CREATE INDEX "Transaction_suggestedCategoryId_idx" ON "Transaction"("suggestedCategoryId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "MerchantAlias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantAlias" ADD CONSTRAINT "MerchantAlias_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantRule" ADD CONSTRAINT "MerchantRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantRule" ADD CONSTRAINT "MerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
