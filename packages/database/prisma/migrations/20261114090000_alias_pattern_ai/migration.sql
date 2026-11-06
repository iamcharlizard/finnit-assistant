-- AI feature `alias_pattern`: proposes the pattern of an automatic name
-- (merchant alias rule) from a few example bank texts. The settings row is
-- inserted by 20261114090100_alias_pattern_ai_default (a new enum value
-- can't be used in the transaction that added it).
-- Rollback: ../../../scripts/rollbacks/20261114090000_alias_pattern_ai.sql (covers both)
ALTER TYPE "AiFeatureKey" ADD VALUE IF NOT EXISTS 'alias_pattern';
