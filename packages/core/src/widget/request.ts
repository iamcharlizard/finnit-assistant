/**
 * The iOS home screen widget's data ("Calendario y pagos"): this month's
 * and next month's due payments (so the widget can turn the month without
 * the app) and the accounts (credit card payment days, account names).
 */
import {
  endOfDayIso,
  firstDayOf,
  startOfDayIso,
  lastDayOf,
  monthOf,
  shiftMonth,
  type DayKey,
} from '../finance/dates';
import {
  ACCOUNT_FIELDS,
  type ApiAccount,
  type Connection,
} from '../finance/types';
import {
  RECURRING_PAYMENT_FIELDS,
  type ApiRecurringPayment,
} from '../recurring/types';

export const WIDGET_QUERY = `query PaymentsWidget($from: DateTime!, $to: DateTime!) {
  upcomingPayments(from: $from, to: $to) { ${RECURRING_PAYMENT_FIELDS} }
  accounts(first: 100) { edges { node { ${ACCOUNT_FIELDS} } } }
}`;

export interface WidgetResult {
  upcomingPayments: ApiRecurringPayment[];
  accounts: Connection<ApiAccount>;
}

export interface WidgetData {
  payments: ApiRecurringPayment[];
  accounts: ApiAccount[];
}

/** From the 1st of today's month to the end of the next one. */
export function widgetVariables(today: DayKey) {
  const month = monthOf(today);
  return {
    from: startOfDayIso(firstDayOf(month)),
    to: endOfDayIso(lastDayOf(shiftMonth(month, 1))),
  };
}

export function widgetData(result: WidgetResult): WidgetData {
  return {
    payments: result.upcomingPayments,
    accounts: result.accounts.edges.map((e) => e.node),
  };
}
