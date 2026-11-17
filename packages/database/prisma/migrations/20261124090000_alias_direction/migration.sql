-- An automatic name (merchant alias) can say whether its movements are
-- income or expenses: some banks send money in with the sign of money out
-- ("MOBILE" transfers). A matching synced expense or income is recorded
-- with that direction. Nothing is set for existing rules.
-- Rollback: ../../../scripts/rollbacks/20261124090000_alias_direction.sql
BEGIN;
ALTER TABLE "MerchantAlias" ADD COLUMN "direction" "TransactionType";
COMMIT;
