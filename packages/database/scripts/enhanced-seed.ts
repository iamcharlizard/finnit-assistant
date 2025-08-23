// Enhanced Seed Script for Finnit Database
// Provides more comprehensive test data for development and testing

import { PrismaClient, AccountType, TransactionType, DebtKind, BankProvider } from '../generated/client';

const prisma = new PrismaClient();

async function enhancedSeed() {
  console.log('🌱 Starting enhanced database seeding...');

  // Create test users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'demo@finnit.app' },
      update: {},
      create: {
        name: 'Demo User',
        email: 'demo@finnit.app',
        passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      },
    }),
    prisma.user.upsert({
      where: { email: 'test@finnit.app' },
      update: {},
      create: {
        name: 'Test User',
        email: 'test@finnit.app',
        passwordHash: '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      },
    }),
  ]);

  const [demoUser, testUser] = users;
  console.log('✅ Users created');

  // Create comprehensive category hierarchy
  const categoryHierarchy = [
    { name: 'Income', subs: ['Salary', 'Freelance', 'Investments', 'Other Income'] },
    { name: 'Food & Dining', subs: ['Groceries', 'Restaurants', 'Fast Food', 'Coffee'] },
    { name: 'Housing', subs: ['Rent/Mortgage', 'Property Tax', 'Home Insurance', 'Maintenance'] },
    { name: 'Transportation', subs: ['Fuel', 'Public Transport', 'Car Maintenance', 'Parking'] },
    { name: 'Utilities', subs: ['Internet', 'Electricity', 'Water', 'Gas', 'Phone'] },
    { name: 'Healthcare', subs: ['Medical', 'Pharmacy', 'Dental', 'Insurance'] },
    { name: 'Shopping', subs: ['Clothing', 'Electronics', 'Home & Garden', 'Personal Care'] },
    { name: 'Entertainment', subs: ['Movies', 'Music', 'Games', 'Sports'] },
    { name: 'Education', subs: ['Tuition', 'Books', 'Courses', 'Training'] },
    { name: 'Financial', subs: ['Bank Fees', 'Investment Fees', 'Loan Interest', 'Credit Card Fees'] },
    { name: 'Miscellaneous', subs: ['Gifts', 'Charity', 'Travel', 'Other'] }
  ];

  const createdCategories: { [key: string]: string } = {};

  // Create root categories and subcategories
  for (const category of categoryHierarchy) {
    const rootCat = await prisma.category.create({
      data: { name: category.name, isDefault: true, userId: null },
    });
    createdCategories[category.name] = rootCat.id;

    for (const subName of category.subs) {
      const subCat = await prisma.category.create({
        data: {
          name: subName,
          isDefault: true,
          userId: null,
          parentId: rootCat.id,
        },
      });
      createdCategories[subName] = subCat.id;
    }
  }
  console.log('✅ Categories created');

  // Create diverse accounts for demo user
  const accounts = await Promise.all([
    // Cash account
    prisma.account.create({
      data: {
        userId: demoUser.id,
        type: AccountType.cash,
        name: 'Cash Wallet',
        currency: 'MXN',
        balanceCurrent: 2500.00,
        metadata: { color: '#10B981', icon: 'wallet' },
      },
    }),
    // Checking account
    prisma.account.create({
      data: {
        userId: demoUser.id,
        type: AccountType.debit,
        name: 'Checking Account - BBVA',
        currency: 'MXN',
        balanceCurrent: 15750.50,
        metadata: { bank: 'BBVA', accountNumber: '****1234', color: '#1E40AF' },
      },
    }),
    // Savings account
    prisma.account.create({
      data: {
        userId: demoUser.id,
        type: AccountType.savings,
        name: 'Savings Account - Banorte',
        currency: 'MXN',
        balanceCurrent: 45000.00,
        metadata: { bank: 'Banorte', accountNumber: '****5678', color: '#DC2626', interestRate: 0.025 },
      },
    }),
    // Credit card
    prisma.account.create({
      data: {
        userId: demoUser.id,
        type: AccountType.credit,
        name: 'Credit Card BBVA Oro',
        currency: 'MXN',
        balanceCurrent: -8500.00,
        metadata: { bank: 'BBVA', last4: '1234', color: '#F59E0B', creditLimit: 50000 },
      },
    }),
    // E-wallet
    prisma.account.create({
      data: {
        userId: demoUser.id,
        type: AccountType.ewallet,
        name: 'OXXO Pay',
        currency: 'MXN',
        balanceCurrent: 750.25,
        metadata: { provider: 'OXXO', color: '#EF4444' },
      },
    }),
  ]);

  const [cashAccount, checkingAccount, savingsAccount, creditAccount, ewalletAccount] = accounts;

  // Add credit card terms
  await prisma.creditCardTerms.create({
    data: {
      accountId: creditAccount.id,
      statementDay: 15,
      paymentDueDay: 5,
      interestRateAnnual: 0.4299,
      minPaymentRule: '5% of balance or $200 MXN minimum',
      gracePeriodDays: 20,
    },
  });

  console.log('✅ Accounts created');

  // Create realistic transaction history (last 3 months)
  const today = new Date();
  const transactions = [];

  // Helper function to create date
  const createDate = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  };

  // Generate monthly salary (last 3 months)
  for (let month = 0; month < 3; month++) {
    transactions.push({
      userId: demoUser.id,
      accountId: checkingAccount.id,
      type: TransactionType.income,
      amount: 25000.00,
      currency: 'MXN',
      txnDate: createDate(30 * month + 1),
      description: `Monthly salary - ${new Date(today.getFullYear(), today.getMonth() - month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      merchantName: 'TechCorp SA',
      source: 'manual' as const,
      categoryId: createdCategories['Salary'],
    });
  }

  // Generate expenses
  const expenseData = [
    { days: 1, amount: 450.00, desc: 'Grocery shopping', merchant: 'Walmart', category: 'Groceries', account: cashAccount.id },
    { days: 2, amount: 85.00, desc: 'Coffee and breakfast', merchant: 'Starbucks', category: 'Coffee', account: ewalletAccount.id },
    { days: 3, amount: 1200.00, desc: 'Monthly rent payment', merchant: 'Property Manager', category: 'Rent/Mortgage', account: checkingAccount.id },
    { days: 4, amount: 65.00, desc: 'Gas station fill-up', merchant: 'Pemex', category: 'Fuel', account: checkingAccount.id },
    { days: 5, amount: 2500.00, desc: 'Health insurance premium', merchant: 'MetLife', category: 'Insurance', account: checkingAccount.id },
    { days: 6, amount: 150.00, desc: 'Dinner with friends', merchant: 'La Parrilla', category: 'Restaurants', account: creditAccount.id },
    { days: 7, amount: 35.00, desc: 'Movie tickets', merchant: 'Cinépolis', category: 'Movies', account: cashAccount.id },
    { days: 8, amount: 890.00, desc: 'Electricity bill', merchant: 'CFE', category: 'Electricity', account: checkingAccount.id },
    { days: 10, amount: 320.00, desc: 'Groceries', merchant: 'Soriana', category: 'Groceries', account: checkingAccount.id },
    { days: 12, amount: 45.00, desc: 'Pharmacy purchase', merchant: 'Farmacias del Ahorro', category: 'Pharmacy', account: cashAccount.id },
    { days: 15, amount: 180.00, desc: 'Car maintenance', merchant: 'AutoZone', category: 'Car Maintenance', account: checkingAccount.id },
    { days: 18, amount: 75.00, desc: 'Internet bill', merchant: 'Telmex', category: 'Internet', account: checkingAccount.id },
    { days: 20, amount: 250.00, desc: 'New clothes', merchant: 'Liverpool', category: 'Clothing', account: creditAccount.id },
    { days: 22, amount: 120.00, desc: 'Lunch meeting', merchant: 'Sanborns', category: 'Restaurants', account: creditAccount.id },
    { days: 25, amount: 500.00, desc: 'Gym membership', merchant: 'Sports World', category: 'Sports', account: checkingAccount.id },
  ];

  for (const expense of expenseData) {
    transactions.push({
      userId: demoUser.id,
      accountId: expense.account,
      type: TransactionType.expense,
      amount: expense.amount,
      currency: 'MXN',
      txnDate: createDate(expense.days),
      description: expense.desc,
      merchantName: expense.merchant,
      source: 'manual' as const,
      categoryId: createdCategories[expense.category],
    });
  }

  // Create transactions
  const createdTransactions = [];
  for (const txData of transactions) {
    const tx = await prisma.transaction.create({ data: txData });
    createdTransactions.push(tx);
  }

  console.log('✅ Transactions created');

  // Create transfers between accounts
  const transferFromCash = await prisma.transaction.create({
    data: {
      userId: demoUser.id,
      accountId: cashAccount.id,
      type: TransactionType.transfer,
      amount: 1000.00,
      currency: 'MXN',
      txnDate: createDate(5),
      description: 'Transfer to savings account',
      source: 'manual',
    },
  });

  const transferToSavings = await prisma.transaction.create({
    data: {
      userId: demoUser.id,
      accountId: savingsAccount.id,
      type: TransactionType.transfer,
      amount: 1000.00,
      currency: 'MXN',
      txnDate: createDate(5),
      description: 'Transfer from cash',
      source: 'manual',
    },
  });

  await prisma.transfer.create({
    data: {
      fromTxnId: transferFromCash.id,
      toTxnId: transferToSavings.id,
      amount: 1000.00,
    },
  });

  console.log('✅ Transfers created');

  // Create financial goals
  const goals = await Promise.all([
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Emergency Fund',
        targetAmount: 60000.00,
        dueDate: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()),
        currency: 'MXN',
        currentAmount: 15000.00,
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'Vacation to Europe',
        targetAmount: 80000.00,
        dueDate: new Date(today.getFullYear(), 11, 1), // December
        currency: 'MXN',
        currentAmount: 25000.00,
      },
    }),
    prisma.goal.create({
      data: {
        userId: demoUser.id,
        name: 'New Laptop',
        targetAmount: 35000.00,
        dueDate: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
        currency: 'MXN',
        currentAmount: 10000.00,
      },
    }),
  ]);

  // Create goal contributions
  const salaryTransaction = createdTransactions.find(t => t.merchantName === 'TechCorp SA');
  if (salaryTransaction) {
    await Promise.all([
      prisma.goalContribution.create({
        data: {
          goalId: goals[0].id, // Emergency fund
          transactionId: salaryTransaction.id,
          amount: 5000.00,
          date: salaryTransaction.txnDate,
        },
      }),
      prisma.goalContribution.create({
        data: {
          goalId: goals[1].id, // Vacation
          transactionId: salaryTransaction.id,
          amount: 3000.00,
          date: salaryTransaction.txnDate,
        },
      }),
    ]);
  }

  console.log('✅ Goals and contributions created');

  // Create debts
  const debts = await Promise.all([
    prisma.debt.create({
      data: {
        userId: demoUser.id,
        name: 'Credit Card BBVA',
        kind: DebtKind.card,
        principal: 8500.00,
        interestRateAnnual: 0.4299,
        minPaymentAmount: 850.00,
        linkedAccountId: creditAccount.id,
      },
    }),
    prisma.debt.create({
      data: {
        userId: demoUser.id,
        name: 'Car Loan',
        kind: DebtKind.loan,
        principal: 185000.00,
        interestRateAnnual: 0.1299,
        minPaymentAmount: 4200.00,
        startDate: createDate(365),
        dueDate: new Date(today.getFullYear() + 3, today.getMonth(), today.getDate()),
      },
    }),
  ]);

  console.log('✅ Debts created');

  // Create monthly budgets
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const budget = await prisma.budget.create({
    data: {
      userId: demoUser.id,
      year: currentYear,
      month: currentMonth,
      currency: 'MXN',
      amountTotal: 20000.00,
    },
  });

  // Create budget categories
  const budgetCategories = [
    { category: 'Food & Dining', amount: 4000.00 },
    { category: 'Transportation', amount: 2000.00 },
    { category: 'Utilities', amount: 1500.00 },
    { category: 'Entertainment', amount: 1000.00 },
    { category: 'Shopping', amount: 2500.00 },
    { category: 'Healthcare', amount: 1000.00 },
  ];

  for (const budgetCat of budgetCategories) {
    const categoryId = createdCategories[budgetCat.category];
    if (categoryId) {
      await prisma.bUDGET_CATEGORY.create({
        data: {
          budgetId: budget.id,
          categoryId,
          capAmount: budgetCat.amount,
        },
      });
    }
  }

  console.log('✅ Budget created');

  // Create bank connection and imported transactions (mock data)
  const bankConnection = await prisma.bankConnection.create({
    data: {
      userId: demoUser.id,
      provider: BankProvider.belvo,
      providerItemId: 'mock_item_bbva_demo',
      status: 'active',
    },
  });

  const linkedAccount = await prisma.linkedAccount.create({
    data: {
      bankConnectionId: bankConnection.id,
      accountId: checkingAccount.id,
      providerAccountId: 'mock_account_checking_bbva',
      mask: '****1234',
      officialName: 'BBVA Bancomer Checking',
      type: 'checking',
      currency: 'MXN',
    },
  });

  // Create some imported transactions
  for (let i = 0; i < 5; i++) {
    await prisma.importedTransaction.create({
      data: {
        linkedAccountId: linkedAccount.id,
        providerTxnId: `mock_import_${i}_${Date.now()}`,
        amount: Math.floor(Math.random() * 500) + 50,
        currency: 'MXN',
        date: createDate(i * 2 + 1),
        merchant: ['Amazon', 'Uber Eats', 'Netflix', 'Spotify', 'PayPal'][i],
        raw: {
          description: `Imported transaction ${i}`,
          category_id: 'mock_category',
          account_id: 'mock_account',
        },
      },
    });
  }

  console.log('✅ Bank connections and imports created');

  // Create notifications
  await Promise.all([
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        type: 'budget',
        title: 'Budget Alert',
        message: 'You have spent 80% of your Food & Dining budget this month.',
        status: 'sent',
        sentAt: new Date(),
        relatedEntityId: budget.id,
        relatedEntityType: 'Budget',
      },
    }),
    prisma.notification.create({
      data: {
        userId: demoUser.id,
        type: 'debt_due',
        title: 'Payment Due',
        message: 'Your credit card payment is due in 3 days.',
        status: 'scheduled',
        scheduledAt: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
        relatedEntityId: debts[0].id,
        relatedEntityType: 'Debt',
      },
    }),
  ]);

  console.log('✅ Notifications created');

  // Create some tags
  const tags = await Promise.all([
    prisma.tag.create({
      data: { userId: demoUser.id, name: 'business' },
    }),
    prisma.tag.create({
      data: { userId: demoUser.id, name: 'personal' },
    }),
    prisma.tag.create({
      data: { userId: demoUser.id, name: 'important' },
    }),
  ]);

  // Tag some transactions
  const businessTransaction = createdTransactions.find(t => t.merchantName === 'Starbucks');
  if (businessTransaction) {
    await prisma.transactionTag.create({
      data: {
        transactionId: businessTransaction.id,
        tagId: tags[0].id, // business tag
      },
    });
  }

  console.log('✅ Tags created');

  console.log(`
🎉 Enhanced seed completed successfully!

📊 Summary:
- Users: ${users.length}
- Accounts: ${accounts.length}
- Categories: ${Object.keys(createdCategories).length}
- Transactions: ${createdTransactions.length}
- Goals: ${goals.length}
- Debts: ${debts.length}
- Budget: 1 monthly budget created
- Bank Connection: 1 mock connection
- Notifications: 2 sample notifications
- Tags: ${tags.length}

🔐 Demo credentials:
- Email: demo@finnit.app
- Password: password

🔗 Database ready for development and testing!
  `);
}

async function main() {
  try {
    await enhancedSeed();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default enhancedSeed;