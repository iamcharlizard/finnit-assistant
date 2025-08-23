-- Backup Script for Finnit Database
-- Creates a backup of critical data before schema changes

-- Create backup schema
CREATE SCHEMA IF NOT EXISTS backup_$(date '+%Y%m%d_%H%M%S');

-- Function to create timestamped backup
-- Usage: SELECT create_backup_with_timestamp();
CREATE OR REPLACE FUNCTION create_backup_with_timestamp()
RETURNS TEXT AS $$
DECLARE
    backup_schema TEXT;
    result TEXT;
BEGIN
    -- Generate timestamp-based schema name
    backup_schema := 'backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
    
    -- Create backup schema
    EXECUTE 'CREATE SCHEMA ' || backup_schema;
    
    -- Backup critical tables with data
    EXECUTE format('CREATE TABLE %I."User" AS SELECT * FROM "User"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Account" AS SELECT * FROM "Account"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Transaction" AS SELECT * FROM "Transaction"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Transfer" AS SELECT * FROM "Transfer"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Goal" AS SELECT * FROM "Goal"', backup_schema);
    EXECUTE format('CREATE TABLE %I."GoalContribution" AS SELECT * FROM "GoalContribution"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Debt" AS SELECT * FROM "Debt"', backup_schema);
    EXECUTE format('CREATE TABLE %I."DebtPayment" AS SELECT * FROM "DebtPayment"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Budget" AS SELECT * FROM "Budget"', backup_schema);
    EXECUTE format('CREATE TABLE %I."BUDGET_CATEGORY" AS SELECT * FROM "BUDGET_CATEGORY"', backup_schema);
    EXECUTE format('CREATE TABLE %I."Category" AS SELECT * FROM "Category"', backup_schema);
    EXECUTE format('CREATE TABLE %I."BankConnection" AS SELECT * FROM "BankConnection"', backup_schema);
    EXECUTE format('CREATE TABLE %I."LinkedAccount" AS SELECT * FROM "LinkedAccount"', backup_schema);
    EXECUTE format('CREATE TABLE %I."ImportedTransaction" AS SELECT * FROM "ImportedTransaction"', backup_schema);
    
    result := 'Backup created successfully in schema: ' || backup_schema;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Quick backup commands for critical data only
-- Use these before running migrations

-- Users and authentication data
-- CREATE TABLE backup_users AS SELECT * FROM "User";

-- Financial data
-- CREATE TABLE backup_accounts AS SELECT * FROM "Account";
-- CREATE TABLE backup_transactions AS SELECT * FROM "Transaction";
-- CREATE TABLE backup_transfers AS SELECT * FROM "Transfer";

-- Goals and debts
-- CREATE TABLE backup_goals AS SELECT * FROM "Goal";
-- CREATE TABLE backup_debts AS SELECT * FROM "Debt";

-- Bank connections (sensitive)
-- CREATE TABLE backup_bank_connections AS SELECT * FROM "BankConnection";
-- CREATE TABLE backup_linked_accounts AS SELECT * FROM "LinkedAccount";

-- To restore from backup:
-- INSERT INTO "User" SELECT * FROM backup_users;
-- (repeat for other tables as needed)

-- Cleanup old backups (run manually as needed):
-- DROP SCHEMA backup_20250101_120000 CASCADE;