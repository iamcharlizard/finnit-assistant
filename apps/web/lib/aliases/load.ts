import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import type { CategorizeCategory } from '@/lib/categorize/types';
import {
  MERCHANT_ALIAS_FIELDS,
  MERCHANT_RULE_FIELDS,
  type ApiMerchantAlias,
  type ApiMerchantRule,
} from './types';

export interface AliasesData {
  aliases: ApiMerchantAlias[];
  rules: ApiMerchantRule[];
  categories: CategorizeCategory[];
}

const ALIASES_QUERY = `query Aliases {
  merchantAliases { ${MERCHANT_ALIAS_FIELDS} }
  merchantRules { ${MERCHANT_RULE_FIELDS} }
  categories { id name parentId key }
}`;

/** Every alias rule, the learned category rules and the category picker. */
export async function loadAliases(): Promise<AliasesData> {
  const data = await serverGraphql<{
    merchantAliases: ApiMerchantAlias[];
    merchantRules: ApiMerchantRule[];
    categories: CategorizeCategory[];
  }>(ALIASES_QUERY);
  return {
    aliases: data.merchantAliases,
    rules: data.merchantRules,
    categories: data.categories,
  };
}
