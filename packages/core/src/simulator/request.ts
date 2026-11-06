/** The simulator's request (its real starting point), shared by the web loader and the mobile app. */
import { BASELINE_FIELDS, type ApiCashFlowBaseline } from './types';

export const SIMULATOR_QUERY = `query SimulatorBaseline { cashFlowBaseline { ${BASELINE_FIELDS} } }`;

export interface SimulatorResult {
  cashFlowBaseline: ApiCashFlowBaseline;
}
