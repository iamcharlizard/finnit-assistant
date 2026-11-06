import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import {
  ALIASES_QUERY,
  aliasesData,
  aliasesVariables,
  type AliasesData,
  type AliasesResult,
} from '@finnit/core/aliases/request';
import { todayKey } from '@finnit/core/finance/dates';

export type { AliasesData };

/** Every automatic name (with this month's and year's spending), the learned category rules and the category picker. */
export async function loadAliases(): Promise<AliasesData> {
  const today = todayKey();
  const data = await serverGraphql<AliasesResult>(ALIASES_QUERY, aliasesVariables(today));
  return aliasesData(data, today);
}
