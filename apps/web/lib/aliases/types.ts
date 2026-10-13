/** Merchant aliases and learned category rules, as the API returns them. */
export type AliasMatchType = 'contains' | 'starts_with' | 'exact' | 'regex';

export const MATCH_TYPES: ReadonlyArray<AliasMatchType> = [
  'contains',
  'starts_with',
  'exact',
  'regex',
];

export interface ApiMerchantAlias {
  id: string;
  matchType: AliasMatchType;
  pattern: string;
  displayName: string;
  category: { id: string; name: string; parentId: string | null } | null;
  isPrivate: boolean;
  priority: number;
  active: boolean;
  matchCount: number;
  createdAt: string;
}

export const MERCHANT_ALIAS_FIELDS =
  'id matchType pattern displayName category { id name parentId } isPrivate priority active matchCount createdAt';

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
  samples: AliasPreviewSample[];
}

export const ALIAS_PREVIEW_FIELDS =
  'count samples { transactionId original date amount currency }';

/** The API's MerchantAliasInput. */
export interface MerchantAliasInput {
  matchType: AliasMatchType;
  pattern: string;
  displayName: string;
  categoryId: string | null;
  isPrivate: boolean;
  priority: number;
  active: boolean;
}
