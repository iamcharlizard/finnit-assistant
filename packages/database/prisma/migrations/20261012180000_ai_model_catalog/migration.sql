-- Catalog of AI models (active / inactive) used for statement extraction.
-- API keys are per provider in env vars, never stored here.
-- Rollback: ../../../scripts/rollbacks/20261012180000_ai_model_catalog.sql
BEGIN;

-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('anthropic', 'openai', 'google');

-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "supportsPdf" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_provider_modelId_key" ON "AiModel"("provider", "modelId");

-- Initial catalog: only the default is active. Admins enable the rest once
-- the provider's API key is configured.
INSERT INTO "AiModel" ("id", "provider", "modelId", "label", "isActive", "isDefault", "supportsPdf", "sortOrder", "updatedAt") VALUES
  (gen_random_uuid(), 'anthropic', 'claude-haiku-5-5',  'Claude Haiku 5.5',  true,  true,  true, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', false, false, true, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'anthropic', 'claude-opus-5-5',   'Claude Opus 5.5',   false, false, true, 30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'openai',    'gpt-5-mini',        'GPT-5 mini',        false, false, true, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'openai',    'gpt-5',             'GPT-5',             false, false, true, 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'google',    'gemini-2.5-flash',  'Gemini 2.5 Flash',  false, false, true, 60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'google',    'gemini-2.5-pro',    'Gemini 2.5 Pro',    false, false, true, 70, CURRENT_TIMESTAMP);

COMMIT;
