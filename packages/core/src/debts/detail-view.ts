import { dayKeyOf, fullDate, longDate, type DayKey } from '../finance/dates';
import {
  DEFAULT_CURRENCY,
  formatMoney,
  percentOf,
  roundCents,
} from '../finance/money';
import type { BudgetCategory } from '../budgets/types';
import type { ApiAccount } from '../finance/types';
import type { Localizer } from '../i18n/translator';
import type {
  ApiDebtDetail,
  ApiLoanPaymentCandidate,
  ApiLoanScheduleItem,
  CandidateReason,
  DebtDestination,
} from './types';
import { formatRate } from './view';

/** Status of one schedule row as the loan page shows it. */
export type ScheduleRowStatus =
  | 'paid'
  | 'historical'
  | 'upcoming'
  | 'overdue'
  | 'skipped'
  | 'projected';

export interface ScheduleRow {
  key: string;
  /** Position in the schedule (1 = first payment). */
  number: number;
  dueDate: DayKey;
  /** With the year: "26 de enero de 2026". */
  dateLabel: string;
  amountLabel: string;
  amount: number;
  status: ScheduleRowStatus;
  /** Set when it can be paid (or moved to another day) from the page. */
  occurrenceId: string | null;
  /**
   * Set when an existing expense can be linked to it: open payments and
   * those paid without a movement (paid before registering the loan).
   */
  linkOccurrenceId: string | null;
  /** Set when it is paid by a movement, which can be unlinked. */
  unlinkOccurrenceId: string | null;
  /** The movement that paid it (opens its detail). */
  transactionId: string | null;
  /** Moved by the user: the date the schedule gave it, with the year. */
  originalDateLabel: string | null;
  /**
   * Loans scheduled by their charges: what each one is for, with its
   * installment ("Pantalla 01/03 · Audífonos 02/06"), or null.
   */
  concept: string | null;
  /** Amortization breakdown (loans by rate), or null. */
  principalLabel: string | null;
  interestLabel: string | null;
  vatLabel: string | null;
  feeLabel: string | null;
  balanceLabel: string;
}

/** One part of what is still owed (stacked bar). */
export interface OutstandingPart {
  key: 'principal' | 'interest' | 'vat' | 'fees';
  amount: number;
  amountLabel: string;
  /** Share of the outstanding total (0–100). */
  percent: number;
  /** Fixed series color (validated chart palette, by entity). */
  color: string;
}

/** What is left to pay, with and without future interest. */
export interface LoanOutstanding {
  /** Principal left: about what paying it off today takes. */
  payoff: number;
  payoffLabel: string;
  /** Proportional estimate (no amortization table to read it from). */
  estimated: boolean;
  /** Everything left: principal + interest + VAT + fees. */
  total: number;
  totalLabel: string;
  /** Interest, VAT and fees not paid when paying it off today. */
  savingLabel: string | null;
  parts: OutstandingPart[];
}

/** Paid vs everything owed (donut). */
export interface LoanPaidShare {
  paid: number;
  paidLabel: string;
  pending: number;
  pendingLabel: string;
  totalLabel: string;
  /** 0–100. */
  percent: number;
}

const PART_COLORS: Record<OutstandingPart['key'], string> = {
  principal: 'var(--chart-1)',
  interest: 'var(--chart-2)',
  vat: 'var(--chart-3)',
  fees: 'var(--chart-4)',
};

/**
 * Splits what is left. Loans by rate read it from their amortization table
 * (open payments' principal, VAT and fees; interest takes the rest so the
 * parts add up to the balance). Others split it in proportion to principal
 * vs total owed.
 */
export function loanOutstanding(
  debt: Pick<
    ApiDebtDetail,
    'remainingBalance' | 'totalOwed' | 'principal' | 'charges'
  >,
  schedule: ApiLoanScheduleItem[],
  money: (n: number) => string,
): LoanOutstanding {
  const total = roundCents(Math.max(0, debt.remainingBalance));
  const open = schedule.filter(
    (item) => item.status === 'upcoming' || item.status === 'missed',
  );
  const exact = open.length > 0 && open.every((item) => item.interest != null);
  const sum = (pick: (item: ApiLoanScheduleItem) => number | null) =>
    roundCents(open.reduce((s, item) => s + (pick(item) ?? 0), 0));

  let principal: number;
  let vat = 0;
  let fees = 0;
  if (exact) {
    principal = Math.min(
      total,
      sum((item) => item.principal),
    );
    vat = sum((item) => item.vat);
    fees = sum((item) => item.fee);
  } else {
    const borrowed =
      debt.principal + debt.charges.reduce((s, c) => s + c.principal, 0);
    const ratio =
      debt.totalOwed > 0 ? Math.min(1, borrowed / debt.totalOwed) : 1;
    principal = roundCents(total * ratio);
  }
  const interest = roundCents(Math.max(0, total - principal - vat - fees));
  const parts = (
    [
      ['principal', principal],
      ['interest', interest],
      ['vat', vat],
      ['fees', fees],
    ] as const
  )
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => ({
      key,
      amount,
      amountLabel: money(amount),
      percent: total > 0 ? (amount / total) * 100 : 0,
      color: PART_COLORS[key],
    }));
  const saving = roundCents(total - principal);
  return {
    payoff: principal,
    payoffLabel: money(principal),
    estimated: !exact && saving > 0,
    total,
    totalLabel: money(total),
    savingLabel: saving > 0 ? money(saving) : null,
    parts,
  };
}

/** One line of the loan's details (read mode). */
export interface DetailFact {
  key: string;
  label: string;
  value: string;
}

export interface ChargeRow {
  id: string;
  dateLabel: string;
  description: string | null;
  principal: string;
  total: string;
  installments: number | null;
  destination: DebtDestination;
  /** Name of the category it was for (informative), or null. */
  purpose: string | null;
}

/** The first amount or one added later (personal loans, purchases). */
export interface LentRow {
  key: string;
  /** Set for amounts added later (they can be removed). */
  chargeId: string | null;
  /** '' when unknown (sorted last). */
  date: DayKey | '';
  dateLabel: string;
  description: string;
  method: string | null;
  purpose: string | null;
  /** What was lent. */
  value: number;
  amount: string;
  /** To repay, when it has interest; else null. */
  total: string | null;
  /** Paid in installments: how many, else null. */
  installments: number | null;
}

export interface PaymentRow {
  id: string;
  date: DayKey;
  /** With the year. */
  dateLabel: string;
  /** For sorting. */
  value: number;
  amount: string;
  isHistorical: boolean;
}

export interface LoanDetailView {
  id: string;
  name: string;
  lenderName: string | null;
  debt: ApiDebtDetail;
  paidOff: boolean;
  remaining: string;
  totalOwed: string;
  paid: string;
  historicalPaid: string | null;
  /** Of everything owed, how much is paid (0–100). */
  paidPercent: number;
  /** Interest over the whole loan (VAT included); null when unknown. */
  interest: string | null;
  /** "12 pagos mensuales de $1,234.56", or null without a schedule. */
  termsLabel: string | null;
  rate: string | null;
  /** "Comisión por apertura $1,160 · recibiste $18,840", or null. */
  openingFeeLabel: string | null;
  /** Name of the category the money was for (informative), or null. */
  purpose: string | null;
  /** "Comisión por pago $299.00", or null. */
  periodicFeeLabel: string | null;
  next: { dateLabel: string; amountLabel: string; overdue: boolean } | null;
  schedule: ScheduleRow[];
  /** Paid vs everything owed. */
  paidShare: LoanPaidShare;
  outstanding: LoanOutstanding;
  /** The schedule has the principal / interest / VAT split. */
  hasBreakdown: boolean;
  /** Has a fee column. */
  hasFees: boolean;
  /** What defines the loan, for its details tab. */
  facts: DetailFact[];
  /** Schedule rows already paid. */
  paidCount: number;
  charges: ChargeRow[];
  /** The first amount and every one added later, newest first. */
  lent: LentRow[];
  payments: PaymentRow[];
}

export function buildLoanDetailView(
  debt: ApiDebtDetail,
  schedule: ApiLoanScheduleItem[],
  {
    today,
    categories = [],
  }: { today: DayKey; categories?: ReadonlyArray<BudgetCategory> },
  { locale, t }: Localizer,
): LoanDetailView {
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  const categoryName = (id: string | null) =>
    (id && categories.find((category) => category.id === id)?.name) || null;
  const date = (iso: string) => longDate(dayKeyOf(iso), today, locale);

  const rows = schedule.map((item, i): ScheduleRow => {
    const day = dayKeyOf(item.dueDate);
    const status: ScheduleRowStatus =
      item.status === 'paid'
        ? item.isHistorical
          ? 'historical'
          : 'paid'
        : item.status === 'skipped'
          ? 'skipped'
          : item.projected
            ? 'projected'
            : item.status === 'missed' || day < today
              ? 'overdue'
              : 'upcoming';
    return {
      key: item.occurrenceId ?? `${item.dueDate}-${i}`,
      number: i + 1,
      dueDate: day,
      dateLabel: fullDate(day, locale),
      amountLabel: money(item.amount),
      amount: item.amount,
      status,
      occurrenceId:
        item.occurrenceId && (status === 'upcoming' || status === 'overdue')
          ? item.occurrenceId
          : null,
      linkOccurrenceId:
        item.occurrenceId &&
        !item.transactionId &&
        (status === 'upcoming' ||
          status === 'overdue' ||
          status === 'historical')
          ? item.occurrenceId
          : null,
      unlinkOccurrenceId:
        item.occurrenceId && item.transactionId && status === 'paid'
          ? item.occurrenceId
          : null,
      transactionId: item.transactionId ?? null,
      originalDateLabel: item.originalDueDate
        ? fullDate(dayKeyOf(item.originalDueDate), locale)
        : null,
      concept: installmentsConcept(item.installments),
      principalLabel: item.principal != null ? money(item.principal) : null,
      interestLabel: item.interest != null ? money(item.interest) : null,
      vatLabel: item.vat != null ? money(item.vat) : null,
      feeLabel: item.fee != null ? money(item.fee) : null,
      balanceLabel: money(item.balance),
    };
  });
  const nextIndex = rows.findIndex(
    (r) =>
      r.status === 'overdue' ||
      r.status === 'upcoming' ||
      r.status === 'projected',
  );
  const next = nextIndex >= 0 ? rows[nextIndex]! : null;

  const chargesPrincipal = debt.charges.reduce((s, c) => s + c.principal, 0);
  const interest =
    debt.totalToRepay != null || debt.charges.length > 0
      ? roundCents(
          debt.totalOwed -
            debt.principal -
            chargesPrincipal -
            (debt.periodicFee ?? 0) * (debt.installmentsTotal ?? 0),
        )
      : null;
  const paid = debt.totalPaid;

  return {
    id: debt.id,
    name: debt.name,
    lenderName: debt.lenderName,
    debt,
    paidOff: debt.status === 'paid_off' || debt.remainingBalance <= 0,
    remaining: money(debt.remainingBalance),
    totalOwed: money(debt.totalOwed),
    paid: money(paid),
    historicalPaid: debt.historicalPaid > 0 ? money(debt.historicalPaid) : null,
    paidPercent: Math.min(100, percentOf(paid, debt.totalOwed)),
    interest: interest != null && interest > 0 ? money(interest) : null,
    termsLabel:
      debt.paymentFrequency && debt.installmentAmount
        ? debt.installmentsTotal
          ? t('debts.detail.terms', {
              count: debt.installmentsTotal,
              frequency: t(`debts.loanFrequencies.${debt.paymentFrequency}`),
              amount: money(debt.installmentAmount),
            })
          : t('debts.detail.termsOpen', {
              frequency: t(`debts.loanFrequencies.${debt.paymentFrequency}`),
              amount: money(debt.installmentAmount),
            })
        : null,
    rate:
      debt.interestRateAnnual != null
        ? formatRate(debt.interestRateAnnual)
        : null,
    purpose: categoryName(debt.purposeCategoryId),
    periodicFeeLabel: debt.periodicFee
      ? t('debts.detail.periodicFee', { fee: money(debt.periodicFee) })
      : null,
    openingFeeLabel: debt.openingFee
      ? t('debts.detail.openingFee', {
          fee: money(debt.openingFee),
          received: money(debt.principal - debt.openingFee),
        })
      : null,
    next: next
      ? {
          dateLabel: next.dateLabel,
          amountLabel: next.amountLabel,
          overdue: next.status === 'overdue',
        }
      : null,
    schedule: rows,
    paidShare: {
      paid: debt.totalPaid,
      paidLabel: money(debt.totalPaid),
      pending: Math.max(0, debt.remainingBalance),
      pendingLabel: money(Math.max(0, debt.remainingBalance)),
      totalLabel: money(debt.totalPaid + Math.max(0, debt.remainingBalance)),
      percent: Math.min(
        100,
        percentOf(
          debt.totalPaid,
          debt.totalPaid + Math.max(0, debt.remainingBalance),
        ),
      ),
    },
    outstanding: loanOutstanding(debt, schedule, money),
    hasBreakdown: schedule.some((item) => item.interest != null),
    hasFees: schedule.some((item) => item.fee != null),
    facts: loanFacts(debt, { money, date, categoryName }, t),
    paidCount: rows.filter(
      (r) => r.status === 'paid' || r.status === 'historical',
    ).length,
    charges: debt.charges.map((charge) => ({
      id: charge.id,
      dateLabel: date(charge.date),
      description: charge.description,
      principal: money(charge.principal),
      total: money(charge.totalToRepay),
      installments: charge.installments,
      destination: charge.destination,
      purpose: categoryName(charge.purposeCategoryId),
    })),
    lent: lentRows(debt, { money, categoryName, locale, t }),
    payments: debt.payments.map((payment) => ({
      id: payment.id,
      date: dayKeyOf(payment.date),
      dateLabel: fullDate(dayKeyOf(payment.date), locale),
      value: payment.amount,
      amount: money(payment.amount),
      isHistorical: payment.isHistorical,
    })),
  };
}

const twoDigits = (n: number) => String(n).padStart(2, '0');

/** "Pantalla 01/03 · 02/06": each charge's installment in a payment. */
export function installmentsConcept(
  installments: ApiLoanScheduleItem['installments'],
): string | null {
  if (!installments?.length) return null;
  return installments
    .map((i) =>
      [i.description, `${twoDigits(i.number)}/${twoDigits(i.of)}`]
        .filter(Boolean)
        .join(' '),
    )
    .join(' · ');
}

function lentRows(
  debt: ApiDebtDetail,
  {
    money,
    categoryName,
    locale,
    t,
  }: {
    money: (n: number) => string;
    categoryName: (id: string | null) => string | null;
    locale: Localizer['locale'];
    t: Localizer['t'];
  },
): LentRow[] {
  const method = (m: ApiDebtDetail['lendingMethod']) =>
    m ? t(`debts.lending.methods.${m}`) : null;
  const initialTotal = debt.totalToRepay ?? debt.principal;
  const start = debt.startDate ? dayKeyOf(debt.startDate) : '';
  const initial: LentRow = {
    key: 'initial',
    chargeId: null,
    date: start,
    dateLabel: start ? fullDate(start, locale) : t('debts.detail.lent.noDate'),
    description:
      debt.description ??
      t(
        debt.loanType === 'purchase_financing'
          ? 'debts.detail.lent.initialPurchase'
          : 'debts.detail.lent.initial',
      ),
    method: method(debt.lendingMethod),
    purpose: categoryName(debt.purposeCategoryId),
    value: debt.principal,
    amount: money(debt.principal),
    total: initialTotal !== debt.principal ? money(initialTotal) : null,
    installments: null,
  };
  const added = debt.charges.map((charge): LentRow => {
    const day = dayKeyOf(charge.date);
    return {
      key: charge.id,
      chargeId: charge.id,
      date: day,
      dateLabel: fullDate(day, locale),
      description: charge.description ?? t('debts.detail.chargeUntitled'),
      method: method(charge.lendingMethod),
      purpose: categoryName(charge.purposeCategoryId),
      value: charge.principal,
      amount: money(charge.principal),
      total:
        charge.totalToRepay !== charge.principal
          ? money(charge.totalToRepay)
          : null,
      installments: charge.installments,
    };
  });
  // A personal loan started at 0 only lists what was added.
  return debt.principal > 0 ? [...added, initial] : added;
}

function loanFacts(
  debt: ApiDebtDetail,
  format: {
    money: (n: number) => string;
    date: (iso: string) => string;
    categoryName: (id: string | null) => string | null;
  },
  t: Localizer['t'],
): DetailFact[] {
  const { money, date, categoryName } = format;
  const label = (
    key:
      | 'name'
      | 'description'
      | 'lender'
      | 'type'
      | 'principal'
      | 'installments'
      | 'frequency'
      | 'rate'
      | 'payment'
      | 'total'
      | 'startDate'
      | 'openingFee'
      | 'periodicFee'
      | 'purpose'
      | 'purposeNone'
      | 'lendingMethod',
  ) => t(`debts.detail.facts.${key}`);
  const facts: Array<DetailFact | null> = [
    { key: 'name', label: label('name'), value: debt.name },
    debt.description
      ? {
          key: 'description',
          label: label('description'),
          value: debt.description,
        }
      : null,
    debt.lenderName
      ? { key: 'lender', label: label('lender'), value: debt.lenderName }
      : null,
    debt.lendingMethod
      ? {
          key: 'lendingMethod',
          label: label('lendingMethod'),
          value: t(`debts.lending.methods.${debt.lendingMethod}`),
        }
      : null,
    debt.loanType
      ? {
          key: 'type',
          label: label('type'),
          value: t(`debts.loanTypes.${debt.loanType}`),
        }
      : null,
    {
      key: 'principal',
      label: label('principal'),
      value: money(debt.principal),
    },
    debt.installmentsTotal
      ? {
          key: 'installments',
          label: label('installments'),
          value: String(debt.installmentsTotal),
        }
      : null,
    debt.paymentFrequency
      ? {
          key: 'frequency',
          label: label('frequency'),
          value: t(`debts.loanFrequencies.${debt.paymentFrequency}`),
        }
      : null,
    debt.interestRateAnnual != null
      ? {
          key: 'rate',
          label: label('rate'),
          value: debt.includesVat
            ? t('debts.detail.rateWithVat', {
                rate: formatRate(debt.interestRateAnnual),
              })
            : formatRate(debt.interestRateAnnual),
        }
      : null,
    debt.installmentAmount
      ? {
          key: 'payment',
          label: label('payment'),
          value: money(debt.installmentAmount),
        }
      : null,
    debt.totalToRepay
      ? {
          key: 'total',
          label: label('total'),
          value: money(debt.totalToRepay),
        }
      : null,
    debt.startDate
      ? {
          key: 'startDate',
          label: label('startDate'),
          value: date(debt.startDate),
        }
      : null,
    debt.openingFee
      ? {
          key: 'openingFee',
          label: label('openingFee'),
          value: money(debt.openingFee),
        }
      : null,
    debt.periodicFee
      ? {
          key: 'periodicFee',
          label: label('periodicFee'),
          value: money(debt.periodicFee),
        }
      : null,
    {
      key: 'purpose',
      label: label('purpose'),
      value: categoryName(debt.purposeCategoryId) ?? label('purposeNone'),
    },
  ];
  return facts.filter((fact): fact is DetailFact => fact !== null);
}

export interface CandidateRow {
  key: string;
  candidate: ApiLoanPaymentCandidate;
  dueLabel: string;
  expectedLabel: string;
  dateLabel: string;
  amountLabel: string;
  description: string;
  accountName: string;
  reason: CandidateReason;
}

export function buildCandidateRows(
  candidates: ApiLoanPaymentCandidate[],
  today: DayKey,
  { locale }: Pick<Localizer, 'locale'>,
): CandidateRow[] {
  const money = (n: number) => formatMoney(n, DEFAULT_CURRENCY, locale);
  return candidates.map((candidate) => ({
    key: `${candidate.occurrenceId}:${candidate.transactionId}`,
    candidate,
    dueLabel: longDate(dayKeyOf(candidate.dueDate), today, locale),
    expectedLabel: money(candidate.expectedAmount),
    dateLabel: longDate(dayKeyOf(candidate.date), today, locale),
    amountLabel: money(candidate.amount),
    description: candidate.description,
    accountName: candidate.accountName,
    reason: candidate.reason,
  }));
}

/** Accounts that can receive a loan's money or pay it (open, home currency). */
export function loanAccounts(
  accounts: ReadonlyArray<ApiAccount>,
): ApiAccount[] {
  return accounts.filter((a) => !a.archived && a.currency === DEFAULT_CURRENCY);
}
