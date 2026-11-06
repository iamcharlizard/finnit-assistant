import 'server-only';

import { serverGraphql } from '@/lib/api/server-graphql';
import { todayKey } from '@finnit/core/finance/dates';
import { SIMULATOR_QUERY, type SimulatorResult } from '@finnit/core/simulator/request';
import { buildSimulatorData, type SimulatorData } from '@finnit/core/simulator/view';

/** The user's real starting point: balance and monthly averages. */
export async function loadSimulator(): Promise<SimulatorData> {
  const data = await serverGraphql<SimulatorResult>(SIMULATOR_QUERY);
  return buildSimulatorData(data.cashFlowBaseline, todayKey());
}
