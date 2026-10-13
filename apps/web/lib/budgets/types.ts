/**
 * Shapes of the budgets API (feature 5) and the GraphQL field selections
 * that fetch them.
 */
export interface ApiBudgetCap {
  id: string;
  categoryId: string;
  capAmount: number;
}

export interface ApiBudget {
  id: string;
  year: number;
  month: number;
  currency: string;
  /** The month's overall limit; null = the sum of the category caps. */
  amountTotal: number | null;
  categories: ApiBudgetCap[];
}

export const BUDGET_FIELDS =
  'id year month currency amountTotal categories { id categoryId capAmount }';

/** One cap's spending: the category and its subcategories, confirmed only. */
export interface ApiBudgetUsage {
  categoryId: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface ApiBudgetSummary {
  budgetId: string;
  year: number;
  month: number;
  /** Sum of the caps (the API ignores amountTotal here). */
  totalBudgeted: number;
  /** Every confirmed expense of the month, capped or not. */
  totalSpent: number;
  categoryUsage: ApiBudgetUsage[];
}

export const BUDGET_SUMMARY_FIELDS =
  'budgetId year month totalBudgeted totalSpent categoryUsage { categoryId budgeted spent remaining percentage }';

/** A category as the budget screens need it (names in the user's language). */
export interface BudgetCategory {
  id: string;
  name: string;
  parentId: string | null;
  /** i18n key of a default category (e.g. 'categories.income'). */
  key: string | null;
}

export const BUDGET_CATEGORY_FIELDS = 'id name parentId key';
