/** The automatic names screen's request, shared by the web loader and the mobile app. */
import type { CategorizeCategory } from '../categorize/types';
import { accountLabel } from '../finance/accounts';
import { endOfDayIso, firstDayOf, lastDayOf, monthOf, startOfDayIso, type DayKey } from '../finance/dates';
import {
  ALIAS_SPENDING_FIELDS,
  MERCHANT_ALIAS_FIELDS,
  MERCHANT_RULE_FIELDS,
  type ApiMerchantAlias,
  type ApiMerchantRule,
} from './types';

export interface AliasesData {
  aliases: ApiMerchantAlias[];
  rules: ApiMerchantRule[];
  categories: CategorizeCategory[];
  /** Account names by id (rules that send movements to one of them). */
  accountNames: Record<string, string>;
  /** "YYYY-MM" of this month, for the "Ver movimientos" links. */
  month: string;
}

export const ALIASES_QUERY = `query Aliases($monthFrom: DateTime!, $monthTo: DateTime!, $yearFrom: DateTime!, $yearTo: DateTime!) {
  merchantAliases { ${MERCHANT_ALIAS_FIELDS} ${ALIAS_SPENDING_FIELDS} }
  merchantRules { ${MERCHANT_RULE_FIELDS} }
  categories { id name parentId key kind icon }
  accounts(first: 100) { edges { node { id name metadata } } }
}`;

export interface AliasesResult {
  merchantAliases: ApiMerchantAlias[];
  merchantRules: ApiMerchantRule[];
  categories: CategorizeCategory[];
  accounts: { edges: { node: { id: string; name: string; metadata: { nickname?: string | null } | null } }[] };
}

export function aliasesVariables(today: DayKey) {
  const month = monthOf(today);
  return {
    monthFrom: startOfDayIso(firstDayOf(month)),
    monthTo: endOfDayIso(lastDayOf(month)),
    yearFrom: startOfDayIso(firstDayOf({ year: month.year, month: 1 })),
    yearTo: endOfDayIso(today),
  };
}

export function aliasesData(data: AliasesResult, today: DayKey): AliasesData {
  const month = monthOf(today);
  return {
    aliases: data.merchantAliases,
    rules: data.merchantRules,
    categories: data.categories,
    accountNames: Object.fromEntries(data.accounts.edges.map(({ node }) => [node.id, accountLabel(node)])),
    month: `${month.year}-${String(month.month).padStart(2, '0')}`,
  };
}
