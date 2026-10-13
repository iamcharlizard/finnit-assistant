import type { Translate } from '@/lib/i18n/translator';

/**
 * Categories as the screens show them: an icon and a color picked from the
 * name (Spanish or English), and the top-level category of a subcategory.
 */
export type IconKey =
  | 'food'
  | 'groceries'
  | 'coffee'
  | 'transport'
  | 'fuel'
  | 'shopping'
  | 'bills'
  | 'subscriptions'
  | 'entertainment'
  | 'health'
  | 'insurance'
  | 'education'
  | 'personal'
  | 'housing'
  | 'loan'
  | 'card'
  | 'income'
  | 'transfer'
  | 'other';

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * A category's name as shown. The API already returns names in the user's
 * language; only "no category" is the web's own text.
 */
export function categoryLabel(
  name: string | null | undefined,
  t: Translate,
): string {
  return name || t('finance.uncategorized');
}

// First match wins: the specific rules (insurance, subscriptions…) go before
// the broad ones they would also match (health, entertainment…).
const ICON_RULES: ReadonlyArray<[RegExp, IconKey]> = [
  [/insurance|seguro/, 'insurance'],
  [/subscription|suscripci|streaming/, 'subscriptions'],
  [/grocer|supermercado|despensa/, 'groceries'],
  [/coffee|caf[eé]/, 'coffee'],
  [/food|dining|restaurant|comida/, 'food'],
  [/^gas$|gasolina|fuel/, 'fuel'],
  [
    /transport|transit|parking|car maint|estacionamiento|auto|taxi|uber/,
    'transport',
  ],
  [/entertain|movie|cine|sport|deporte|hobb|pasatiempo|ocio/, 'entertainment'],
  [
    /bill|utilit|electric|water|internet|phone|servicio|luz|agua|tel[eé]fono/,
    'bills',
  ],
  [
    /health|medical|doctor|pharmac|fitness|salud|m[eé]dic|farmacia|ejercicio/,
    'health',
  ],
  [/educat|tuition|textbook|suppl|colegiatura|escuela|[uú]tiles/, 'education'],
  [/personal|hair|beauty|groom|belleza|cabello/, 'personal'],
  [/rent|renta|hipoteca|vivienda|housing/, 'housing'],
  [
    /income|salary|freelance|invest|ingreso|salario|n[oó]mina|inversi/,
    'income',
  ],
  [/shop|cloth|electronic|book|compra|ropa|libro/, 'shopping'],
];

export function iconKeyForName(name: string | null | undefined): IconKey {
  const value = (name ?? '').toLowerCase();
  return ICON_RULES.find(([pattern]) => pattern.test(value))?.[1] ?? 'other';
}

export const ICON_COLORS: Record<IconKey, string> = {
  food: '#f59e0b',
  groceries: '#10b981',
  coffee: '#b7791f',
  transport: '#3b82f6',
  fuel: '#0ea5e9',
  shopping: '#ec4899',
  bills: '#6c72cb',
  subscriptions: '#a855f7',
  entertainment: '#8b5cf6',
  health: '#ef4444',
  insurance: '#14b8a6',
  education: '#0891b2',
  personal: '#f472b6',
  housing: '#00696e',
  loan: '#64748b',
  card: '#6c72cb',
  income: '#00a86b',
  transfer: '#64748b',
  other: '#94a3b8',
};

export type CategoryIndex = ReadonlyMap<string, CategoryNode>;

export function indexCategories(
  categories: ReadonlyArray<CategoryNode>,
): CategoryIndex {
  return new Map(categories.map((c) => [c.id, c]));
}

/** The top-level category (itself when it has no parent). */
export function rootCategory(
  index: CategoryIndex,
  id: string | null | undefined,
): CategoryNode | null {
  let node = id ? index.get(id) : undefined;
  // Bounded walk in case of a malformed (cyclic) tree.
  for (let i = 0; node?.parentId && i < 10; i++) {
    const parent = index.get(node.parentId);
    if (!parent) break;
    node = parent;
  }
  return node ?? null;
}

/** Icon of a category: its own name first, then its top-level category's. */
export function categoryIconKey(
  index: CategoryIndex,
  id: string | null | undefined,
): IconKey {
  const own = id ? index.get(id) : undefined;
  const key = iconKeyForName(own?.name);
  if (key !== 'other') return key;
  return iconKeyForName(rootCategory(index, id)?.name);
}
