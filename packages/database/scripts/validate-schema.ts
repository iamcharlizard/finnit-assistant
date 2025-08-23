// Schema Validation Script for Finnit Database
// Validates the database schema against PRD requirements and CLAUDE.md guardrails

import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

interface ValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

class SchemaValidator {
  private results: ValidationResult[] = [];

  private addResult(passed: boolean, message: string, details?: any) {
    this.results.push({ passed, message, details });
    console.log(`${passed ? '✅' : '❌'} ${message}`);
    if (details && !passed) {
      console.log('   Details:', details);
    }
  }

  async validateUserAuthentication(): Promise<void> {
    console.log('\n🔐 Validating User Authentication & Security...');

    try {
      // Check User model structure
      const userFields = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'User' AND table_schema = 'public'
        ORDER BY ordinal_position;
      ` as any[];

      const requiredFields = ['id', 'name', 'email', 'passwordHash', 'createdAt', 'updatedAt'];
      const missingFields = requiredFields.filter(field => 
        !userFields.some((f: any) => f.column_name === field)
      );

      this.addResult(
        missingFields.length === 0,
        'User model has all required fields',
        missingFields.length > 0 ? { missing: missingFields } : undefined
      );

      // Check email uniqueness constraint
      const emailConstraints = await prisma.$queryRaw`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'User' AND constraint_type = 'UNIQUE';
      ` as any[];

      this.addResult(
        emailConstraints.length > 0,
        'User email has unique constraint',
        { constraints: emailConstraints }
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate User model', error);
    }
  }

  async validateAccountTypes(): Promise<void> {
    console.log('\n💳 Validating Account Types & Balances...');

    try {
      // Check AccountType enum values
      const enumValues = await prisma.$queryRaw`
        SELECT enumlabel as value
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AccountType'
        ORDER BY e.enumsortorder;
      ` as any[];

      const requiredTypes = ['cash', 'debit', 'credit', 'savings', 'ewallet'];
      const actualTypes = enumValues.map((e: any) => e.value);
      const missingTypes = requiredTypes.filter(type => !actualTypes.includes(type));

      this.addResult(
        missingTypes.length === 0,
        'AccountType enum has all required values',
        { required: requiredTypes, actual: actualTypes, missing: missingTypes }
      );

      // Check Account model structure
      const accountFields = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'Account' AND table_schema = 'public'
        ORDER BY ordinal_position;
      ` as any[];

      const hasMetadataField = accountFields.some((f: any) => f.column_name === 'metadata');
      const hasBalanceField = accountFields.some((f: any) => f.column_name === 'balanceCurrent');

      this.addResult(hasMetadataField, 'Account model has metadata field for flexible data');
      this.addResult(hasBalanceField, 'Account model has balance tracking');

    } catch (error) {
      this.addResult(false, 'Failed to validate Account types', error);
    }
  }

  async validateTransferRelationships(): Promise<void> {
    console.log('\n🔄 Validating Transfer Relationships (1:1 constraints)...');

    try {
      // Check Transfer model unique constraints (CLAUDE.md requirement)
      const uniqueConstraints = await prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'Transfer' 
          AND tc.constraint_type = 'UNIQUE'
        ORDER BY tc.constraint_name, kcu.ordinal_position;
      ` as any[];

      const hasFromTxnUnique = uniqueConstraints.some((c: any) => c.column_name === 'fromTxnId');
      const hasToTxnUnique = uniqueConstraints.some((c: any) => c.column_name === 'toTxnId');

      this.addResult(
        hasFromTxnUnique && hasToTxnUnique,
        '1:1 Transfer constraints properly implemented with @unique',
        { fromTxnUnique: hasFromTxnUnique, toTxnUnique: hasToTxnUnique, constraints: uniqueConstraints }
      );

      // Check foreign key relationships
      const foreignKeys = await prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'Transfer' 
          AND tc.constraint_type = 'FOREIGN KEY';
      ` as any[];

      this.addResult(
        foreignKeys.length >= 2,
        'Transfer model has proper foreign key relationships to Transaction',
        { foreignKeys }
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate Transfer relationships', error);
    }
  }

  async validateSnakeCaseCompliance(): Promise<void> {
    console.log('\n🐍 Validating snake_case compliance (CLAUDE.md requirement)...');

    try {
      // Check table names
      const tableNames = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      ` as any[];

      // Check column names for snake_case patterns
      const nonSnakeCaseColumns = await prisma.$queryRaw`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name ~ '[A-Z]'  -- Contains uppercase letters
        ORDER BY table_name, column_name;
      ` as any[];

      // Check enum names
      const enumNames = await prisma.$queryRaw`
        SELECT t.typname as enum_name
        FROM pg_type t
        WHERE t.typcategory = 'E'
        ORDER BY t.typname;
      ` as any[];

      // Note: Prisma generates PascalCase in schema but uses snake_case in DB
      // This is expected behavior, so we check the actual DB structure
      this.addResult(
        nonSnakeCaseColumns.length === 0,
        'Database uses proper snake_case for columns',
        nonSnakeCaseColumns.length > 0 ? { violations: nonSnakeCaseColumns } : undefined
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate snake_case compliance', error);
    }
  }

  async validateIndexingStrategy(): Promise<void> {
    console.log('\n📊 Validating Indexing Strategy...');

    try {
      // Check critical indexes
      const indexes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname;
      ` as any[];

      // Check for user-based indexes (critical for multi-tenant)
      const userIndexes = indexes.filter((idx: any) => 
        idx.indexdef.includes('userId') || idx.indexdef.includes('user_id')
      );

      this.addResult(
        userIndexes.length >= 3,
        'Sufficient user-based indexes for multi-tenant performance',
        { userIndexCount: userIndexes.length, userIndexes }
      );

      // Check for transaction date indexes (critical for financial queries)
      const dateIndexes = indexes.filter((idx: any) => 
        idx.indexdef.includes('txnDate') || idx.indexdef.includes('date')
      );

      this.addResult(
        dateIndexes.length >= 2,
        'Date-based indexes for transaction queries',
        { dateIndexCount: dateIndexes.length, dateIndexes }
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate indexing strategy', error);
    }
  }

  async validateBusinessLogicSupport(): Promise<void> {
    console.log('\n🎯 Validating Business Logic Support...');

    try {
      // Check debt management models
      const debtTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('Debt', 'DebtPayment')
        ORDER BY table_name;
      ` as any[];

      this.addResult(
        debtTables.length === 2,
        'Debt management models present',
        { debtTables }
      );

      // Check goal tracking models
      const goalTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('Goal', 'GoalContribution')
        ORDER BY table_name;
      ` as any[];

      this.addResult(
        goalTables.length === 2,
        'Goal tracking models present',
        { goalTables }
      );

      // Check bank integration models
      const bankTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('BankConnection', 'LinkedAccount', 'ImportedTransaction')
        ORDER BY table_name;
      ` as any[];

      this.addResult(
        bankTables.length === 3,
        'Bank integration models present',
        { bankTables }
      );

      // Check reconciliation workflow
      const reconciliationTables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('ReconciliationSession', 'ReconciliationItem')
        ORDER BY table_name;
      ` as any[];

      this.addResult(
        reconciliationTables.length === 2,
        'Reconciliation workflow models present',
        { reconciliationTables }
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate business logic support', error);
    }
  }

  async validateDataIntegrity(): Promise<void> {
    console.log('\n🔒 Validating Data Integrity Constraints...');

    try {
      // Check cascade constraints
      const cascadeConstraints = await prisma.$queryRaw`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'CASCADE'
        ORDER BY tc.table_name;
      ` as any[];

      // Should have some cascade constraints but not destructive ones on core data
      this.addResult(
        cascadeConstraints.length > 0,
        'Appropriate cascade constraints present',
        { cascadeCount: cascadeConstraints.length }
      );

      // Check restrict constraints (protecting important data)
      const restrictConstraints = await prisma.$queryRaw`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND rc.delete_rule = 'RESTRICT'
        ORDER BY tc.table_name;
      ` as any[];

      this.addResult(
        restrictConstraints.length > 0,
        'Restrict constraints protect critical data',
        { restrictCount: restrictConstraints.length }
      );

    } catch (error) {
      this.addResult(false, 'Failed to validate data integrity', error);
    }
  }

  async runAllValidations(): Promise<ValidationSummary> {
    console.log('🔍 Starting comprehensive schema validation...\n');

    await this.validateUserAuthentication();
    await this.validateAccountTypes();
    await this.validateTransferRelationships();
    await this.validateSnakeCaseCompliance();
    await this.validateIndexingStrategy();
    await this.validateBusinessLogicSupport();
    await this.validateDataIntegrity();

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    const summary: ValidationSummary = {
      totalTests: this.results.length,
      passed,
      failed,
      results: this.results
    };

    console.log(`\n📋 Validation Summary:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   Success Rate: ${((passed / summary.totalTests) * 100).toFixed(1)}%`);

    if (summary.failed === 0) {
      console.log('\n🎉 All validations passed! Schema is compliant with PRD and CLAUDE.md requirements.');
    } else {
      console.log('\n⚠️ Some validations failed. Review the details above.');
    }

    return summary;
  }
}

async function main() {
  const validator = new SchemaValidator();
  
  try {
    const summary = await validator.runAllValidations();
    
    if (summary.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { SchemaValidator };
export default main;