import type { Localizer, Translate } from '@/lib/i18n/translator';
import { accountLabel } from '@/lib/finance/accounts';
import { categoryLabel } from '@/lib/finance/categories';
import {
  dayKeyOf,
  longDate,
  shortDate,
  type DayKey,
} from '@/lib/finance/dates';
import { formatMoney } from '@/lib/finance/money';
import type {
  ApiStatementDetail,
  ApiStatementImport,
  ApiStatementLine,
  LineKind,
  LineStatus,
  StatementAccount,
  StatementCategory,
  StatementStatus,
} from './types';

/** Still being extracted: the review page polls until it isn't. */
export function isWorking(status: StatementStatus): boolean {
  return status === 'uploaded' || status === 'processing';
}

export type BadgeVariant =
  | 'muted'
  | 'highlight'
  | 'brand'
  | 'success'
  | 'expense';

export const STATUS_BADGE: Record<StatementStatus, BadgeVariant> = {
  uploaded: 'muted',
  processing: 'highlight',
  needs_review: 'brand',
  confirmed: 'success',
  failed: 'expense',
};

/** Kinds that add to what the card owes (charges); the rest lower it. */
const DEBIT_KINDS: ReadonlySet<LineKind> = new Set([
  'charge',
  'fee',
  'interest',
  'installment',
]);

export function isDebit(kind: LineKind): boolean {
  return DEBIT_KINDS.has(kind);
}

/**
 * Who parsed the statement: "Banamex", "IA: claude-sonnet-4-5" or just "IA"
 * (null before extraction).
 */
export function parserLabel(
  parser: string | null,
  t: Translate,
): string | null {
  if (!parser) return null;
  if (parser === 'banamex_v1') return 'Banamex';
  if (parser === 'ai' || parser.startsWith('ai:')) {
    const model = parser.slice(3).split('/').pop()?.trim();
    return model
      ? t('statements.parserAi', { model })
      : t('statements.parserAiAny');
  }
  return parser;
}

/** Below half a cent the totals match. */
export function hasDifference(difference: number | null): boolean {
  return difference !== null && Math.abs(difference) >= 0.005;
}

const day = (value: string | null): DayKey | null =>
  value ? dayKeyOf(value) : null;

/** "15 sep – 14 oct 2026", or the cut-off day alone, or null. */
export function periodLabel(
  s: Pick<ApiStatementImport, 'periodStart' | 'periodEnd' | 'statementDate'>,
  locale: Localizer['locale'],
): string | null {
  const start = day(s.periodStart);
  const end = day(s.periodEnd) ?? day(s.statementDate);
  if (!end) return null;
  const year = end.slice(0, 4);
  if (!start) return `${shortDate(end, locale)} ${year}`;
  return `${shortDate(start, locale)} – ${shortDate(end, locale)} ${year}`;
}

export function accountsById(
  accounts: ReadonlyArray<StatementAccount>,
): Map<string, StatementAccount> {
  return new Map(accounts.map((a) => [a.id, a]));
}

/** "Mi Banamex · 1234": nickname or name, plus the last digits. */
export function cardLabel(account: StatementAccount): string {
  const last4 = account.metadata?.last4?.trim();
  const label = accountLabel(account);
  return last4 && !label.includes(last4) ? `${label} · ${last4}` : label;
}

/** Credit cards a statement can be uploaded for (not archived). */
export function uploadAccountOptions(
  accounts: ReadonlyArray<StatementAccount>,
): { value: string; label: string }[] {
  return accounts
    .filter((a) => a.type === 'credit' && !a.archived)
    .map((a) => ({ value: a.id, label: cardLabel(a) }));
}

export interface StatementListItem {
  id: string;
  href: string;
  account: string;
  period: string;
  status: StatementStatus;
  statusLabel: string;
  balance: string | null;
  /** Shown only when the totals don't match. */
  difference: string | null;
  uploadedOn: string;
}

export function toStatementListItem(
  s: ApiStatementImport,
  accounts: ReadonlyMap<string, StatementAccount>,
  { locale, t }: Localizer,
): StatementListItem {
  const account = accounts.get(s.accountId);
  return {
    id: s.id,
    href: `/statements/${s.id}`,
    account: account ? accountLabel(account) : t('statements.unknownAccount'),
    period: periodLabel(s, locale) ?? t('statements.periodPending'),
    status: s.status,
    statusLabel: t(`statements.status.${s.status}`),
    balance:
      s.statementBalance === null
        ? null
        : formatMoney(s.statementBalance, s.currency, locale),
    difference: hasDifference(s.difference)
      ? formatMoney(s.difference!, s.currency, locale, { sign: 'always' })
      : null,
    uploadedOn: shortDate(dayKeyOf(s.createdAt), locale),
  };
}

export interface StatementFact {
  key: string;
  label: string;
  value: string;
}

export interface StatementLineView {
  id: string;
  day: DayKey;
  date: string;
  description: string;
  kind: LineKind;
  kindLabel: string;
  /** Signed by kind: charges "-$299.00", payments/refunds "+$500.00". */
  amount: string;
  variant: 'income' | 'expense';
  installments: string | null;
  status: LineStatus;
  statusLabel: string;
  categoryId: string | null;
  categoryLabel: string | null;
  matchedTransactionHref: string | null;
  recurring: { href: string; label: string } | null;
  /** Raw values the linking dialog searches with. */
  rawAmount: number;
}

export function toLineView(
  line: ApiStatementLine,
  categories: ReadonlyMap<string, StatementCategory>,
  { locale, t }: Localizer,
): StatementLineView {
  const lineDay = dayKeyOf(line.date);
  const debit = isDebit(line.kind);
  const recurring = line.matchedRecurringPayment;
  const category = line.suggestedCategoryId
    ? categories.get(line.suggestedCategoryId)
    : undefined;
  return {
    id: line.id,
    day: lineDay,
    date: shortDate(lineDay, locale),
    description:
      line.merchant?.trim() ||
      line.description?.trim() ||
      t(`statements.kinds.${line.kind}`),
    kind: line.kind,
    kindLabel: t(`statements.kinds.${line.kind}`),
    amount: formatMoney(
      debit ? -line.amount : line.amount,
      line.currency,
      locale,
      {
        sign: 'always',
      },
    ),
    variant: debit ? 'expense' : 'income',
    installments:
      line.installmentNumber && line.installmentTotal
        ? `${line.installmentNumber}/${line.installmentTotal}`
        : null,
    status: line.status,
    statusLabel: t(`statements.lineStatus.${line.status}`),
    categoryId: line.suggestedCategoryId,
    categoryLabel: category
      ? categoryLabel(category.name, t)
      : debit
        ? categoryLabel(null, t)
        : null,
    matchedTransactionHref: line.matchedTransactionId
      ? `/transactions/${line.matchedTransactionId}`
      : null,
    recurring: recurring
      ? {
          href: `/recurring?date=${dayKeyOf(recurring.dueDate)}`,
          label: recurring.name,
        }
      : null,
    rawAmount: line.amount,
  };
}

export type LineCounts = Record<LineStatus, number>;

export function lineCounts(
  lines: ReadonlyArray<Pick<ApiStatementLine, 'status'>>,
): LineCounts {
  const counts: LineCounts = { pending: 0, matched: 0, created: 0, ignored: 0 };
  for (const line of lines) counts[line.status] += 1;
  return counts;
}

export interface StatementDetailView {
  id: string;
  accountId: string;
  account: string;
  period: string;
  status: StatementStatus;
  statusLabel: string;
  parser: string | null;
  errorMessage: string | null;
  facts: StatementFact[];
  /** Statement balance vs previous balance + lines. */
  check: {
    computed: string | null;
    statement: string | null;
    difference: string | null;
    mismatch: boolean;
  };
  lines: StatementLineView[];
  counts: LineCounts;
  canEdit: boolean;
  canConfirm: boolean;
  canDelete: boolean;
  canReprocess: boolean;
  fileHref: string | null;
}

export function statementFileHref(id: string): string {
  return `/api/files/statements/${encodeURIComponent(id)}/file`;
}

export function toStatementDetailView(
  s: ApiStatementDetail,
  accounts: ReadonlyMap<string, StatementAccount>,
  categories: ReadonlyMap<string, StatementCategory>,
  today: DayKey,
  l: Localizer,
): StatementDetailView {
  const { locale, t } = l;
  const money = (value: number | null) =>
    value === null ? null : formatMoney(value, s.currency, locale);
  const date = (value: string | null) =>
    value ? longDate(dayKeyOf(value), today, locale) : null;
  const account = accounts.get(s.accountId);
  const lines = s.lines ?? [];

  const facts: [string, string | null][] = [
    ['previousBalance', money(s.previousBalance)],
    ['totalCharges', money(s.totalCharges)],
    ['totalCredits', money(s.totalCredits)],
    ['statementBalance', money(s.statementBalance)],
    ['minimumPayment', money(s.minimumPayment)],
    ['noInterestPayment', money(s.noInterestPayment)],
    ['statementDate', date(s.statementDate)],
    ['paymentDueDate', date(s.paymentDueDate)],
  ];
  const working = isWorking(s.status);

  return {
    id: s.id,
    accountId: s.accountId,
    account: account ? accountLabel(account) : t('statements.unknownAccount'),
    period: periodLabel(s, locale) ?? t('statements.periodPending'),
    status: s.status,
    statusLabel: t(`statements.status.${s.status}`),
    parser: parserLabel(s.parser, t),
    errorMessage: s.status === 'failed' ? s.errorMessage : null,
    facts: facts
      .filter((f): f is [string, string] => f[1] !== null)
      .map(([key, value]) => ({
        key,
        label: t(`statements.facts.${key as FactKey}`),
        value,
      })),
    check: {
      computed: money(s.computedTotal),
      statement: money(s.statementBalance),
      difference:
        s.difference === null
          ? null
          : formatMoney(s.difference, s.currency, locale, { sign: 'always' }),
      mismatch: hasDifference(s.difference),
    },
    lines: lines.map((line) => toLineView(line, categories, l)),
    counts: lineCounts(lines),
    canEdit: s.status === 'needs_review',
    canConfirm: s.status === 'needs_review',
    canDelete: s.status !== 'confirmed' && !working,
    canReprocess: s.source === 'pdf' && s.status !== 'confirmed' && !working,
    fileHref: s.source === 'pdf' ? statementFileHref(s.id) : null,
  };
}

type FactKey =
  | 'previousBalance'
  | 'totalCharges'
  | 'totalCredits'
  | 'statementBalance'
  | 'minimumPayment'
  | 'noInterestPayment'
  | 'statementDate'
  | 'paymentDueDate';

export function categoriesById(
  categories: ReadonlyArray<StatementCategory>,
): Map<string, StatementCategory> {
  return new Map(categories.map((c) => [c.id, c]));
}
