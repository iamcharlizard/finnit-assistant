/**
 * A credit card's "Crédito utilizado" split: one-off spending (and the
 * installments already billed) and purchases in installments still to
 * come. A purchase the bank charged whole sits in what the card owes; one
 * billed month by month adds its installments as they come (owed on top).
 */
import { formatMoney } from '../finance/money';
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
  oneOff: string;
  installments: string;
  /** Shares of what is owed (0–100), for a split bar; they add up to 100. */
  oneOffPercent: number;
  installmentsPercent: number;
  /** Purchases in installments still running. */
  plans: number;
  /** "Más $600.00 de mensualidades que la tarjeta aún no carga". */
  outsideNote: string | null;
}

/** Null without purchases in installments (nothing to split). */
export function buildCreditUsageView(
  usage: ApiCreditUsage | null,
  currency: string,
  { locale, t }: Localizer,
): CreditUsageView | null {
  if (!usage || (usage.plans === 0 && usage.outside === 0)) return null;
  const money = (n: number) => formatMoney(n, currency, locale);
  const installmentsPercent =
    usage.used > 0 ? Math.round((usage.installments / usage.used) * 100) : 0;
  return {
    oneOff: money(usage.oneOff),
    installments: money(usage.installments),
    oneOffPercent: usage.used > 0 ? 100 - installmentsPercent : 0,
    installmentsPercent,
    plans: usage.plans,
    outsideNote:
      usage.outside > 0
        ? t('accounts.creditUsage.outside', { amount: money(usage.outside) })
        : null,
  };
}
