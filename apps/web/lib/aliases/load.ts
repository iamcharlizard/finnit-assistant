import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import type { CategorizeCategory } from '@/lib/categorize/types';
import {
  endOfDayIso,
  firstDayOf,
  lastDayOf,
  monthOf,
  startOfDayIso,
  todayKey,
} from '@/lib/finance/dates';
import { accountLabel } from '@/lib/finance/accounts';
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

const ALIASES_QUERY = `query Aliases($monthFrom: DateTime!, $monthTo: DateTime!, $yearFrom: DateTime!, $yearTo: DateTime!) {
  merchantAliases { ${MERCHANT_ALIAS_FIELDS} ${ALIAS_SPENDING_FIELDS} }
  merchantRules { ${MERCHANT_RULE_FIELDS} }
  categories { id name parentId key kind icon }
  accounts(first: 100) { edges { node { id name metadata } } }
}`;

/** Every automatic name (with this month's and year's spending), the learned category rules and the category picker. */
export async function loadAliases(): Promise<AliasesData> {
  const today = todayKey();
  const month = monthOf(today);
  const data = await serverGraphql<{
    merchantAliases: ApiMerchantAlias[];
    merchantRules: ApiMerchantRule[];
    categories: CategorizeCategory[];
    accounts: {
      edges: {
        node: {
          id: string;
          name: string;
          metadata: { nickname?: string | null } | null;
        };
      }[];
    };
  }>(ALIASES_QUERY, {
    monthFrom: startOfDayIso(firstDayOf(month)),
    monthTo: endOfDayIso(lastDayOf(month)),
    yearFrom: startOfDayIso(firstDayOf({ year: month.year, month: 1 })),
    yearTo: endOfDayIso(today),
  });
  return {
    aliases: data.merchantAliases,
    rules: data.merchantRules,
    categories: data.categories,
    accountNames: Object.fromEntries(
      data.accounts.edges.map(({ node }) => [node.id, accountLabel(node)]),
    ),
    month: `${month.year}-${String(month.month).padStart(2, '0')}`,
  };
}
