-- Whether an account adds up to the total balance (home and "Cuentas y
-- tarjetas"); the user can leave one out. Every existing account counts.
-- Rollback: ../../../scripts/rollbacks/20261118090000_account_include_in_total.sql
BEGIN;
ALTER TABLE "Account" ADD COLUMN "includeInTotal" BOOLEAN NOT NULL DEFAULT true;
COMMIT;
