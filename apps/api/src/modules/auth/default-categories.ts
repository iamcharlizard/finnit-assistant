import type { PrismaClient, Prisma } from '@finnit/database';

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

/** Starter categories every new user gets. */
export async function createDefaultCategories(
  prisma: PrismaClientLike,
  userId: string,
): Promise<void> {
  // Names must be unique per user (category_user_name_unique), including
  // children across different parents.
  const defaultCategories = [
    // Expenses
    {
      name: 'Food & Dining',
      children: ['Groceries', 'Restaurants', 'Coffee & Snacks'],
    },
    {
      name: 'Transportation',
      children: ['Gas', 'Public Transit', 'Parking', 'Car Maintenance'],
    },
    {
      name: 'Shopping',
      children: ['Clothing', 'Electronics', 'Books', 'General'],
    },
    {
      name: 'Bills & Utilities',
      children: ['Electricity', 'Water', 'Internet', 'Phone', 'Home Insurance'],
    },
    {
      name: 'Entertainment',
      children: ['Movies', 'Sports', 'Hobbies', 'Subscriptions'],
    },
    {
      name: 'Health & Medical',
      children: ['Doctor', 'Pharmacy', 'Fitness', 'Health Insurance'],
    },
    { name: 'Education', children: ['Tuition', 'Textbooks', 'Supplies'] },
    { name: 'Personal Care', children: ['Hair', 'Beauty', 'Grooming'] },

    // Income
    {
      name: 'Income',
      children: ['Salary', 'Freelance', 'Investments', 'Other Income'],
    },

    // Other
    { name: 'Uncategorized', children: [] },
  ];

  for (let i = 0; i < defaultCategories.length; i++) {
    const parent = defaultCategories[i];

    const parentCategory = await prisma.category.create({
      data: {
        userId,
        name: parent.name,
        sortOrder: i + 1,
        isDefault: false,
      },
    });

    // Create child categories
    for (let j = 0; j < parent.children.length; j++) {
      await prisma.category.create({
        data: {
          userId,
          parentId: parentCategory.id,
          name: parent.children[j],
          sortOrder: j + 1,
          isDefault: false,
        },
      });
    }
  }
}
