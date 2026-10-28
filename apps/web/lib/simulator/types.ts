/** The API's cashFlowBaseline: where cashFlowProjection starts from. */
export interface ApiCashFlowBaseline {
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  /** Months averaged, 1–6. */
  monthsOfData: number;
  currency: string;
}

export const BASELINE_FIELDS =
  'currentBalance monthlyIncome monthlyExpenses monthsOfData currency';
