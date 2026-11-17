/**
 * A credit card's "Crédito utilizado" split: one-off spending (and the
 * installments already billed) and purchases in installments still to
 * come. A purchase the bank charged whole sits in what the card owes; one
 * billed month by month adds its installments as they come (owed on top).
 */
import { formatMoney, roundCents } from '../finance/money';
import type { Localizer } from '../i18n/translator';

export const CREDIT_USAGE_FIELDS = 'used installments oneOff outside plans';

export interface ApiCreditUsage {
  used: number;
  installments: number;
  oneOff: number;
  outside: number;
  plans: number;
}

export interface CreditUsageView {
  /** Credit used: what the card owes plus installments it doesn't have yet. */
  total: string;
  /** One-off spending and installments already billed. */
  oneOff: string;
  /** Every installment still to bill, of every purchase in installments. */
  installments: string;
  /** Shares of `total` (0–100), for the split bar; they add up to 100. */
  oneOffPercent: number;
  installmentsPercent: number;
  /** Against the limit (0–100), for the "Crédito utilizado" bar; null without a limit. */
  ofLimit: { total: number; oneOff: number; installments: number } | null;
  /** Purchases in installments still running. */
  plans: number;
}

/**
 * Credit used split into one-off and installments still to bill. A
 * purchase charged whole already sits in what the card owes; one billed
 * month by month (`outside`) adds its installments still to come on top,
 * so the credit used is the balance plus those. Null without purchases in
 * installments (nothing to split: the balance is the credit used).
 */
export function buildCreditUsageView(
  usage: ApiCreditUsage | null,
  currency: string,
  limit: number | null,
  { locale }: Pick<Localizer, 'locale'>,
): CreditUsageView | null {
  if (!usage || (usage.plans === 0 && usage.outside === 0)) return null;
  const money = (n: number) => formatMoney(roundCents(n), currency, locale);
  const installments = usage.installments + usage.outside;
  const total = usage.oneOff + installments;
  const installmentsPercent =
    total > 0 ? Math.round((installments / total) * 100) : 0;
  const pct = (n: number) =>
    limit && limit > 0 ? Math.min(100, Math.max(0, (n / limit) * 100)) : 0;
  return {
    total: money(total),
    oneOff: money(usage.oneOff),
    installments: money(installments),
    oneOffPercent: total > 0 ? 100 - installmentsPercent : 0,
    installmentsPercent,
    ofLimit:
      limit && limit > 0
        ? {
            total: Math.round(pct(total)),
            oneOff: pct(usage.oneOff),
            installments: Math.min(pct(installments), 100 - pct(usage.oneOff)),
          }
        : null,
    plans: usage.plans,
  };
}
