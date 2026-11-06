-- Privacy PIN: automatic names (merchant alias rules) can be protected, so
-- that whoever opens the account can't see what they look for, change them
-- or see their movements' bank text without the user's PIN. Forgotten PINs
-- are reset through a single-use emailed link (stored hashed).
-- Rollback: ../../../scripts/rollbacks/20261114100000_privacy_pin.sql
BEGIN;

-- AlterTable
ALTER TABLE "MerchantAlias" ADD COLUMN     "isProtected" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "privacyPinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "privacyPinHash" TEXT,
ADD COLUMN     "privacyPinLockedUntil" TIMESTAMP(3),
ADD COLUMN     "privacyPinVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PrivacyPinReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyPinReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrivacyPinReset_tokenHash_key" ON "PrivacyPinReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PrivacyPinReset_userId_idx" ON "PrivacyPinReset"("userId");

-- AddForeignKey
ALTER TABLE "PrivacyPinReset" ADD CONSTRAINT "PrivacyPinReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
