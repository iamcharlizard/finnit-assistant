-- Invitation-only access: roles (admin / master), Google sign-in, disabled
-- users and session revocation (tokenVersion); per-feature AI settings.
-- Rollback: ../../../scripts/rollbacks/20261014090000_admin_access_and_ai_features.sql
BEGIN;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "AiFeatureKey" AS ENUM ('statement_parsing');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "googleSubject" TEXT,
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "isMaster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AiFeature" (
    "key" "AiFeatureKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "aiModelId" TEXT,
    "useFallbacks" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFeature_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeature" ADD CONSTRAINT "AiFeature_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeature" ADD CONSTRAINT "AiFeature_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- At most one master user.
CREATE UNIQUE INDEX "User_single_master_key" ON "User"("isMaster") WHERE "isMaster";

-- PDF statement reading keeps today's behavior: on, default model, fallbacks.
INSERT INTO "AiFeature" ("key", "enabled", "useFallbacks", "updatedAt")
VALUES ('statement_parsing', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

COMMIT;
