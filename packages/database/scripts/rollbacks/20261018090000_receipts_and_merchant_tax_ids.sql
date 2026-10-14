-- Rollback for migration 20261018090000_receipts_and_merchant_tax_ids.
-- Loses: every receipt draft (ReceiptImport rows) and the learned merchant
-- tax IDs. Transactions created from receipts and their attachments are
-- kept (they live in Transaction / Attachment). The receipt photos stay in
-- S3 under users/<id>/receipts/ until deleted by hand.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollbacks/20261018090000_receipts_and_merchant_tax_ids.sql

BEGIN;
DROP TABLE IF EXISTS "ReceiptImport";
DROP TABLE IF EXISTS "MerchantTaxId";
DROP TYPE IF EXISTS "ReceiptStatus";
DROP TYPE IF EXISTS "ReceiptRoute";
DROP TYPE IF EXISTS "ReceiptConfidence";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261018090000_receipts_and_merchant_tax_ids';
COMMIT;
