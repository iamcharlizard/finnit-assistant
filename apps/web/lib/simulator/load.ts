import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey } from '@finnit/core/finance/dates';
import { BASELINE_FIELDS, type ApiCashFlowBaseline } from '@finnit/core/simulator/types';
import { buildSimulatorData, type SimulatorData } from '@finnit/core/simulator/view';

/** The user's real starting point: balance and monthly averages. */
export async function loadSimulator(): Promise<SimulatorData> {
  const data = await serverGraphql<{ cashFlowBaseline: ApiCashFlowBaseline }>(
    `query SimulatorBaseline { cashFlowBaseline { ${BASELINE_FIELDS} } }`,
  );
  return buildSimulatorData(data.cashFlowBaseline, todayKey());
}
