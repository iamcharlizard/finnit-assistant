/** Merchant aliases and learned category rules, as the API returns them. */
export type AliasMatchType = 'contains' | 'starts_with' | 'exact' | 'regex';

export const MATCH_TYPES: ReadonlyArray<AliasMatchType> = [
  'contains',
  'starts_with',
  'exact',
  'regex',
];

export interface AliasSpending {
  count: number;
  /** Spent minus received. */
  total: number;
  currency: string;
}

export interface ApiMerchantAlias {
  id: string;
  matchType: AliasMatchType;
  /** Null for a protected rule until the privacy PIN is entered. */
  pattern: string | null;
  displayName: string;
  category: { id: string; name: string; parentId: string | null } | null;
  isPrivate: boolean;
  /** Needs the privacy PIN to see or change it. */
  isProtected: boolean;
  /** Protected and not unlocked: pattern hidden, changes refused. */
  locked: boolean;
  priority: number;
  active: boolean;
  /** Matching bank movements are suggested as a transfer to this account. */
  transferAccountId: string | null;
  matchCount: number;
  createdAt: string;
  /** This month and this year (only in the list query). */
  month?: AliasSpending;
  year?: AliasSpending;
}

export const MERCHANT_ALIAS_FIELDS =
  'id matchType pattern displayName category { id name parentId } isPrivate isProtected locked priority active transferAccountId matchCount createdAt';

/** The list's extra fields: spending this month and year ($monthFrom… variables). */
export const ALIAS_SPENDING_FIELDS =
  'month: spending(from: $monthFrom, to: $monthTo) { count total currency } year: spending(from: $yearFrom, to: $yearTo) { count total currency }';

export interface ApiMerchantRule {
  id: string;
  pattern: string;
  category: { id: string; name: string; parentId: string | null };
  hits: number;
  updatedAt: string;
}

export const MERCHANT_RULE_FIELDS =
  'id pattern category { id name parentId } hits updatedAt';

export interface AliasPreviewSample {
  transactionId: string;
  original: string;
  date: string;
  amount: number;
  currency: string;
}

export interface AliasPreview {
  count: number;
  /** Of those, how many keep their one-off name. */
  withOwnName: number;
  /** Of those, how many keep a higher-priority rule's name. */
  withOtherRule: number;
  samples: AliasPreviewSample[];
}

export const ALIAS_PREVIEW_FIELDS =
  'count withOwnName withOtherRule samples { transactionId original date amount currency }';

/** What suggestAliasPattern proposes. */
export interface AliasPatternSuggestion {
  matchType: AliasMatchType;
  pattern: string;
  explanation: string;
  source: 'ai' | 'heuristic';
  coversAll: boolean;
  aiUnavailable: boolean;
  preview: AliasPreview;
}

/** The API's MerchantAliasInput. */
export interface MerchantAliasInput {
  matchType: AliasMatchType;
  pattern: string;
  displayName: string;
  categoryId: string | null;
  isPrivate: boolean;
  priority: number;
  active: boolean;
  transferAccountId: string | null;
  isProtected: boolean;
}
