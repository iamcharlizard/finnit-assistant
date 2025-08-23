// prisma/seed.js
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../generated/client'));
const crypto = require('crypto');
const prisma = new PrismaClient();

// Función para generar hash de contraseña usando crypto nativo
function hashPassword(password, salt = null) {
  // Si no se proporciona salt, generar uno aleatorio
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  // Usar PBKDF2 para hashing seguro
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  // Retornar en formato salt:hash
  return `${salt}:${hash}`;
}

// Función para limpiar todas las tablas (opcional)
async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...');

  // Orden de eliminación respetando las foreign keys
  await prisma.goalContribution.deleteMany({});
  await prisma.debtPayment.deleteMany({});
  await prisma.transfer.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.debt.deleteMany({});
  await prisma.goal.deleteMany({});
  await prisma.creditCardTerms.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Base de datos limpiada');
}

async function main() {
  // Verificar si se debe limpiar la base de datos
  const shouldClean = process.argv.includes('--clean');

  if (shouldClean) {
    await cleanDatabase();
  }

  console.log('🌱 Iniciando seed de la base de datos...');

  // 1) Demo user (usando upsert)
  const user = await prisma.user.upsert({
    where: { email: 'demo@finnit.app' },
    update: {
      name: 'Demo User',
      passwordHash: hashPassword('demo123'),
    },
    create: {
      name: 'Demo User',
      email: 'demo@finnit.app',
      passwordHash: hashPassword('demo123'),
    },
  });

  console.log('✅ Usuario demo creado/actualizado:', user.email);

  // 2) Default categories (usando upsert)
  const rootCats = [
    { name: 'Food', isDefault: true },
    { name: 'Housing', isDefault: true },
    { name: 'Transport', isDefault: true },
    { name: 'Health', isDefault: true },
    { name: 'Entertainment', isDefault: true },
    { name: 'Utilities', isDefault: true },
    { name: 'Shopping', isDefault: true },
    { name: 'Income', isDefault: true },
    { name: 'Fees', isDefault: true },
  ];

  const createdRoots = {};
  for (const rc of rootCats) {
    // Para categorías globales (userId: null), usar findFirst + create
    let c = await prisma.category.findFirst({
      where: {
        name: rc.name,
        userId: null
      }
    });

    if (!c) {
      c = await prisma.category.create({
        data: {
          name: rc.name,
          isDefault: rc.isDefault,
          userId: null
        }
      });
    }

    createdRoots[rc.name] = c.id;
  }

  const subcats = [
    { name: 'Groceries', parent: 'Food' },
    { name: 'Restaurants', parent: 'Food' },
    { name: 'Rent/Mortgage', parent: 'Housing' },
    { name: 'Fuel', parent: 'Transport' },
    { name: 'Public Transport', parent: 'Transport' },
    { name: 'Internet', parent: 'Utilities' },
    { name: 'Electricity', parent: 'Utilities' },
    { name: 'Medical', parent: 'Health' },
    { name: 'Pharmacy', parent: 'Health' },
    { name: 'Salary', parent: 'Income' },
    { name: 'Freelance', parent: 'Income' },
    { name: 'Bank Fees', parent: 'Fees' },
  ];

  for (const sc of subcats) {
    // Para subcategorías globales (userId: null), usar findFirst + create
    const existingSubcat = await prisma.category.findFirst({
      where: {
        name: sc.name,
        userId: null
      }
    });

    if (!existingSubcat) {
      await prisma.category.create({
        data: {
          name: sc.name,
          isDefault: true,
          userId: null,
          parentId: createdRoots[sc.parent],
        }
      });
    }
  }

  console.log('✅ Categorías creadas/actualizadas');

  // 3) Accounts: cash + credit card (usando upsert)
  const cash = await prisma.account.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Cash Wallet'
      }
    },
    update: {
      type: 'cash',
      currency: 'MXN',
      balanceCurrent: 1500.00,
      metadata: { color: '#10B981', icon: 'wallet' },
    },
    create: {
      userId: user.id,
      type: 'cash',
      name: 'Cash Wallet',
      currency: 'MXN',
      balanceCurrent: 1500.00,
      metadata: { color: '#10B981', icon: 'wallet' },
    },
  });

  const credit = await prisma.account.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Credit Card BBVA'
      }
    },
    update: {
      type: 'credit',
      currency: 'MXN',
      balanceCurrent: -1200.00,
      metadata: { bank: 'BBVA', last4: '1234', color: '#1E3A8A' },
    },
    create: {
      userId: user.id,
      type: 'credit',
      name: 'Credit Card BBVA',
      currency: 'MXN',
      balanceCurrent: -1200.00,
      metadata: { bank: 'BBVA', last4: '1234', color: '#1E3A8A' },
    },
  });

  // Credit card terms (usando upsert)
  await prisma.creditCardTerms.upsert({
    where: { accountId: credit.id },
    update: {
      statementDay: 10,
      paymentDueDay: 25,
      interestRateAnnual: 0.3999,
      minPaymentRule: 'percent',
      gracePeriodDays: 20,
    },
    create: {
      accountId: credit.id,
      statementDay: 10,
      paymentDueDay: 25,
      interestRateAnnual: 0.3999,
      minPaymentRule: 'percent',
      gracePeriodDays: 20,
    },
  });

  console.log('✅ Cuentas creadas/actualizadas');

  // Helpers
  const today = new Date();
  const toDateOnly = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  // 4) Transactions: income and expense (usando upsert con identificadores únicos)
  const salaryCat = await prisma.category.findFirst({ where: { name: 'Salary', userId: null } });
  const groceriesCat = await prisma.category.findFirst({ where: { name: 'Groceries', userId: null } });

  const tIncome = await prisma.transaction.upsert({
    where: {
      transaction_user_account_date_unique: {
        userId: user.id,
        accountId: cash.id,
        txnDate: toDateOnly(today),
      }
    },
    update: {
      type: 'income',
      amount: 20000.00,
      currency: 'MXN',
      merchantName: 'ACME Corp',
      source: 'manual',
      categoryId: salaryCat?.id || null,
    },
    create: {
      userId: user.id,
      accountId: cash.id,
      type: 'income',
      amount: 20000.00,
      currency: 'MXN',
      txnDate: toDateOnly(today),
      description: 'Monthly salary',
      merchantName: 'ACME Corp',
      source: 'manual',
      categoryId: salaryCat?.id || null,
    },
  });

  const tExpense = await prisma.transaction.upsert({
    where: {
      transaction_user_account_date_unique: {
        userId: user.id,
        accountId: cash.id,
        txnDate: toDateOnly(today),
      }
    },
    update: {
      type: 'expense',
      amount: 850.50,
      currency: 'MXN',
      merchantName: 'SuperMart',
      source: 'manual',
      categoryId: groceriesCat?.id || null,
    },
    create: {
      userId: user.id,
      accountId: cash.id,
      type: 'expense',
      amount: 850.50,
      currency: 'MXN',
      txnDate: toDateOnly(today),
      description: 'Groceries at SuperMart',
      merchantName: 'SuperMart',
      source: 'manual',
      categoryId: groceriesCat?.id || null,
    },
  });

  // 5) Transfer: from cash to card (simulates payment)
  const tFrom = await prisma.transaction.upsert({
    where: {
      transaction_user_account_date_unique: {
        userId: user.id,
        accountId: cash.id,
        txnDate: toDateOnly(today),
      }
    },
    update: {
      type: 'transfer',
      amount: 1000.00,
      currency: 'MXN',
      source: 'manual',
    },
    create: {
      userId: user.id,
      accountId: cash.id,
      type: 'transfer',
      amount: 1000.00,
      currency: 'MXN',
      txnDate: toDateOnly(today),
      description: 'Transfer to credit card',
      source: 'manual',
    },
  });

  const tTo = await prisma.transaction.upsert({
    where: {
      transaction_user_account_date_unique: {
        userId: user.id,
        accountId: credit.id,
        txnDate: toDateOnly(today),
      }
    },
    update: {
      type: 'transfer',
      amount: 1000.00,
      currency: 'MXN',
      source: 'manual',
    },
    create: {
      userId: user.id,
      accountId: credit.id,
      type: 'transfer',
      amount: 1000.00,
      currency: 'MXN',
      txnDate: toDateOnly(today),
      description: 'Transfer from cash',
      source: 'manual',
    },
  });

  // Verificar si ya existe la transferencia para evitar duplicados
  const existingTransfer = await prisma.transfer.findFirst({
    where: {
      fromTxnId: tFrom.id,
      toTxnId: tTo.id,
    },
  });

  if (!existingTransfer) {
    await prisma.transfer.create({
      data: {
        fromTxnId: tFrom.id,
        toTxnId: tTo.id,
        amount: 1000.00,
      },
    });
  }

  console.log('✅ Transacciones creadas/actualizadas');

  // 6) Goal + contribution (usando upsert)
  const goal = await prisma.goal.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'Emergency Fund'
      }
    },
    update: {
      targetAmount: 30000.00,
      dueDate: null,
      currency: 'MXN',
      currentAmount: 0,
    },
    create: {
      userId: user.id,
      name: 'Emergency Fund',
      targetAmount: 30000.00,
      dueDate: null,
      currency: 'MXN',
      currentAmount: 0,
    },
  });

  // Verificar si ya existe la contribución para evitar duplicados
  const existingContribution = await prisma.goalContribution.findFirst({
    where: {
      goalId: goal.id,
      transactionId: tIncome.id,
    },
  });

  if (!existingContribution) {
    await prisma.goalContribution.create({
      data: {
        goalId: goal.id,
        transactionId: tIncome.id,
        amount: 3000.00,
        date: toDateOnly(today),
      },
    });
  }

  // 7) Debt + payment (usando upsert)
  const debt = await prisma.debt.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: 'BBVA Credit'
      }
    },
    update: {
      kind: 'card',
      principal: 1200.00,
      interestRateAnnual: 0.3999,
      minPaymentAmount: 200.00,
      linkedAccountId: credit.id,
    },
    create: {
      userId: user.id,
      name: 'BBVA Credit',
      kind: 'card',
      principal: 1200.00,
      interestRateAnnual: 0.3999,
      minPaymentAmount: 200.00,
      linkedAccountId: credit.id,
    },
  });

  // Verificar si ya existe el pago para evitar duplicados
  const existingPayment = await prisma.debtPayment.findFirst({
    where: {
      debtId: debt.id,
      transactionId: tTo.id,
    },
  });

  if (!existingPayment) {
    await prisma.debtPayment.create({
      data: {
        debtId: debt.id,
        transactionId: tTo.id,
        amount: 1000.00,
        date: toDateOnly(today),
      },
    });
  }

  // 8) Monthly budget (global) - ya usa upsert
  const now = new Date();
  const budget = await prisma.budget.upsert({
    where: {
      userId_year_month: {
        userId: user.id,
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      },
    },
    update: {
      currency: 'MXN',
      amountTotal: 15000.00,
    },
    create: {
      userId: user.id,
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      currency: 'MXN',
      amountTotal: 15000.00,
    },
  });

  console.log('✅ Seed completado exitosamente:', {
    user: user.email,
    accounts: { cash: cash.name, credit: credit.name },
    budget: `${budget.year}-${budget.month}`,
  });
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
