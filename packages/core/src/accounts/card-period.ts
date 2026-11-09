import type { Localizer } from '../i18n/translator';
import {
  dayKeyOf,
  relativeDayLabel,
  shortDate,
  type DayKey,
} from '../finance/dates';
import { formatMoney } from '../finance/money';

/**
 * A credit card's billing cycle (de corte a corte) as the API computes it:
 * owed at the cut-off, the no-interest payment, what was paid towards it by
 * the due date and what is left.
 */
export type CardPeriodStatus = 'open' | 'due' | 'paid' | 'unpaid';

export interface ApiCardPeriod {
  id: string;
  accountId: string;
  periodStart: string;
  statementDate: string;
  paymentDueDate: string;
  balanceAtStatement: number;
  pendingInstallments: number;
  /** Installments billed in the cycle (all purchases in installments). */
  installmentsInCycle: number;
  /** Installments still to bill after the cut-off. */
  installmentBalance: number;
  /** De contado: the no-interest payment without the installments. */
  cashBalance: number;
  installments: ApiCardPeriodInstallment[];
  noInterestPayment: number;
  minimumPayment: number | null;
  paid: number;
  remaining: number;
  status: CardPeriodStatus;
  fromStatement: boolean;
  connected: boolean;
  interestEstimate: number | null;
  interestRecorded: boolean;
  interestCategoryId: string | null;
  interestRateAnnual: number | null;
  currency: string;
}

/** One installment of a card purchase billed in the cycle. */
export interface ApiCardPeriodInstallment {
  debtId: string;
  name: string;
  number: number;
  total: number;
  amount: number;
  /** Left to bill after this one. */
  left: number;
}

export const CARD_PERIOD_FIELDS =
  'id accountId periodStart statementDate paymentDueDate balanceAtStatement pendingInstallments installmentsInCycle installmentBalance cashBalance installments { debtId name number total amount left } noInterestPayment minimumPayment paid remaining status fromStatement connected interestEstimate interestRecorded interestCategoryId interestRateAnnual currency';

/** How many cycles the card's detail loads at a time. */
export const CARD_PERIODS_PAGE = 6;

export const CARD_PERIODS_QUERY = `query CardPeriods($accountId: ID!, $first: Int!, $after: String) {
  creditCardPeriods(accountId: $accountId, first: $first, after: $after) {
    edges { node { ${CARD_PERIOD_FIELDS} } cursor }
    pageInfo { endCursor hasNextPage }
  }
}`;

export interface CardPeriodsResult {
  creditCardPeriods: {
    edges: { node: ApiCardPeriod; cursor: string }[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  };
}

export type CardPeriodTone = 'neutral' | 'warning' | 'danger' | 'success';

/** What "Registrar intereses" starts from. */
export interface InterestDraft {
  accountId: string;
  categoryId: string | null;
  /** Raw amount for the form ("46.40"), empty without an estimate. */
  amount: string;
  /** "$46.40" or null. */
  estimate: string | null;
  currency: string;
}

/** What "Pagar tarjeta" starts from. */
export interface CardPaymentDraft {
  accountId: string;
  /** Raw amount for the form ("4000.00"). */
  amount: string;
  /** The due date: paying after it counts for the next cycle. */
  dueDate: DayKey;
}

export interface CardPeriodPlan {
  debtId: string;
  /** "Pantalla · 3 de 12" */
  label: string;
  amount: string;
  /** "Quedan $9,000.00" (null on the last one). */
  left: string | null;
  href: string;
}

export interface CardPeriodView {
  id: string;
  statementDay: DayKey;
  /** "8 oct – 7 nov" */
  range: string;
  status: CardPeriodStatus;
  /** "En curso", "Por pagar", "Pagado", "Vencido" */
  statusLabel: string;
  tone: CardPeriodTone;
  /** The line under the title: what to do about it. */
  headline: string;
  /** "Saldo al corte" ("Saldo hasta hoy" while open) and its amount. */
  balanceLabel: string;
  balance: string;
  noInterestPayment: string;
  paid: string;
  remaining: string;
  remainingAmount: number;
  /** Paid share of the no-interest payment, 0–100 (closed cycles). */
  progress: number | null;
  minimumPayment: string | null;
  /** MSI of the cycle not on the card yet, included in the payment. */
  pendingInstallments: string | null;
  /**
   * The payment split in de contado and this cut-off's installments, and
   * what is left in installments; null without purchases in installments.
   */
  split: {
    cash: string;
    installments: string;
    balance: string;
    plans: CardPeriodPlan[];
  } | null;
  /** "27 nov" · "En 3 días" */
  dueDate: string;
  dueRelative: string;
  statementDate: string;
  fromStatement: boolean;
  /** Movements of the cycle in the history. */
  historyHref: string;
  pay: CardPaymentDraft | null;
  interest: InterestDraft | null;
}

const TONES: Record<CardPeriodStatus, CardPeriodTone> = {
  open: 'neutral',
  due: 'warning',
  paid: 'success',
  unpaid: 'danger',
};

const rawAmount = (n: number) => n.toFixed(2);

export function toCardPeriodView(
  period: ApiCardPeriod,
  today: DayKey,
  { locale, t }: Localizer,
): CardPeriodView {
  const money = (n: number) => formatMoney(n, period.currency, locale);
  const start = dayKeyOf(period.periodStart);
  const cut = dayKeyOf(period.statementDate);
  const due = dayKeyOf(period.paymentDueDate);
  const open = period.status === 'open';
  const remaining = money(period.remaining);
  const dueDate = shortDate(due, locale);

  const headline = open
    ? t('cards.period.headline.open', { date: shortDate(cut, locale) })
    : period.status === 'paid'
      ? t('cards.period.headline.paid', { date: dueDate })
      : period.status === 'unpaid'
        ? t('cards.period.headline.unpaid', {
            amount: remaining,
            date: dueDate,
          })
        : t('cards.period.headline.due', { amount: remaining, date: dueDate });

  const askInterest =
    period.status === 'unpaid' && !period.connected && !period.interestRecorded;

  return {
    id: period.id,
    statementDay: cut,
    range: `${shortDate(start, locale)} – ${shortDate(cut, locale)}`,
    status: period.status,
    statusLabel: t(`cards.period.status.${period.status}`),
    tone: TONES[period.status],
    headline,
    balanceLabel: open
      ? t('cards.period.balanceSoFar')
      : t('cards.period.balanceAtStatement'),
    balance: money(period.balanceAtStatement),
    noInterestPayment: money(period.noInterestPayment),
    paid: money(period.paid),
    remaining,
    remainingAmount: period.remaining,
    progress:
      open || period.noInterestPayment <= 0
        ? null
        : Math.min(
            100,
            Math.round((period.paid / period.noInterestPayment) * 100),
          ),
    minimumPayment:
      period.minimumPayment !== null ? money(period.minimumPayment) : null,
    pendingInstallments:
      period.pendingInstallments > 0 ? money(period.pendingInstallments) : null,
    split:
      period.installments.length > 0 || period.installmentBalance > 0
        ? {
            cash: money(period.cashBalance),
            installments: money(period.installmentsInCycle),
            balance: money(period.installmentBalance),
            plans: period.installments.map((i) => ({
              debtId: i.debtId,
              label: t('cards.period.planRow', {
                name: i.name,
                number: i.number,
                total: i.total,
              }),
              amount: money(i.amount),
              left:
                i.left > 0
                  ? t('cards.period.planLeft', { amount: money(i.left) })
                  : null,
              href: `/planning/debts/${encodeURIComponent(i.debtId)}`,
            })),
          }
        : null,
    dueDate,
    dueRelative: relativeDayLabel(due, today, locale),
    statementDate: shortDate(cut, locale),
    fromStatement: period.fromStatement,
    historyHref: `/history?account=${encodeURIComponent(period.accountId)}&from=${start}&to=${cut}`,
    pay:
      !open && period.remaining > 0
        ? {
            accountId: period.accountId,
            amount: rawAmount(period.remaining),
            dueDate: due,
          }
        : null,
    interest: askInterest
      ? {
          accountId: period.accountId,
          categoryId: period.interestCategoryId,
          amount:
            period.interestEstimate !== null
              ? rawAmount(period.interestEstimate)
              : '',
          estimate:
            period.interestEstimate !== null
              ? money(period.interestEstimate)
              : null,
          currency: period.currency,
        }
      : null,
  };
}

/** Paying on `day` counts for this cycle only up to its due date. */
export function paysLate(draft: CardPaymentDraft, day: DayKey): boolean {
  return day > draft.dueDate;
}
