/**
 * The iOS home screen widget "Calendario y pagos" (medium size): the
 * month's calendar on the left, the payments still to make on the right,
 * in the order they are due. The widget can't fetch or format anything,
 * so everything arrives here as plain, already formatted props, one set
 * per day (a timeline), so "today" and overdue payments move on by
 * themselves.
 */
import { cardDatesIn, kindColor, toPaymentItem } from '../recurring/view';
import {
  addDays,
  daysBetween,
  firstDayOf,
  lastDayOf,
  monthGridDays,
  monthLabel,
  monthOf,
  parseDayKey,
  shiftMonth,
  shortDate,
  weekdayNames,
  type DayKey,
} from '../finance/dates';
import { hexToRgb, isHexColor } from '../format/color';
import type { Localizer } from '../i18n/translator';
import type { WidgetData } from './request';

/** A dot under a day: the most urgent of its payments. */
export type WidgetDayMark = 'none' | 'pending' | 'overdue' | 'paid' | 'card';

export interface WidgetDay {
  key: string;
  /** "14"; empty for the padding before the 1st. */
  label: string;
  today: boolean;
  mark: WidgetDayMark;
}

export interface WidgetPayment {
  key: string;
  name: string;
  /** "Hoy", "Mañana", "14 oct", "Vencido · 12 oct". */
  when: string;
  /** "$219.00", "≈ $450.00" or "••••" with "Ocultar montos". */
  amount: string;
  /** The payment kind's color (hex). */
  color: string;
  overdue: boolean;
}

export interface WidgetColors {
  /** A solid background (every palette but Glass). */
  background: string;
  /**
   * Glass: its soft background blobs as a left-to-right gradient (a
   * widget gets one background style); empty for the other palettes.
   */
  gradient: string[];
  text: string;
  muted: string;
  /** Today's circle. */
  accent: string;
  accentText: string;
  pending: string;
  overdue: string;
  paid: string;
  card: string;
}

export interface PaymentsWidgetProps {
  status: 'ready' | 'signedOut';
  monthLabel: string;
  /** Monday first: "L", "M", "M", "J"… */
  weekdays: string[];
  /** Weeks of 7 days, Monday first. */
  weeks: WidgetDay[][];
  title: string;
  payments: WidgetPayment[];
  /**
   * "+3 más" when they don't all fit, else empty. Never null: the props go
   * to the App Group's UserDefaults, which can't store null (the app crashes).
   */
  moreLabel: string;
  emptyLabel: string;
  /** Shown instead of everything when signed out. */
  message: string;
  /** Opened on tap. */
  url: string;
  colors: { light: WidgetColors; dark: WidgetColors };
}

/** One of the app's background blobs (Glass), as the theme tokens describe it. */
export interface WidgetBlob {
  /** Center, 0–1 from the left. */
  cx: number;
  /** `rgb(r, g, b)` at the center, and its opacity there. */
  color: string;
  opacity: number;
}

const RGB = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/;

/**
 * Glass's background for the widget: each blob over the plain background
 * (at its opacity), ordered left to right. Hex stops, since the widget
 * only takes plain colors.
 */
export function glassGradient(
  background: string,
  blobs: readonly WidgetBlob[],
): string[] {
  if (blobs.length === 0 || !isHexColor(background)) return [];
  const base = hexToRgb(background);
  const hex = (channels: number[]) =>
    `#${channels
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')}`;
  return [...blobs]
    .sort((a, b) => a.cx - b.cx)
    .flatMap((blob) => {
      const m = RGB.exec(blob.color);
      if (!m) return [];
      const color = [Number(m[1]), Number(m[2]), Number(m[3])];
      return [
        hex(
          base.map((c, i) => c * (1 - blob.opacity) + color[i]! * blob.opacity),
        ),
      ];
    });
}

/** Rows that fit on the right in the medium size. */
export const WIDGET_MAX_ROWS = 4;
/** Masked amounts ("Ocultar montos"). */
export const HIDDEN_AMOUNT = '••••';
/** Deep link opened on tap (Expo Router path in the app). */
export const WIDGET_URL = 'finnitapp:///calendar';

const MARK_RANK: Record<WidgetDayMark, number> = {
  none: 0,
  card: 1,
  paid: 2,
  pending: 3,
  overdue: 4,
};

/** Monday-first initials: L M M J V S D / M T W T F S S. */
function weekdayInitials(locale: Localizer['locale']): string[] {
  const names = weekdayNames(locale);
  return [...names.slice(1), names[0]!].map((n) => n.slice(0, 1).toUpperCase());
}

export function buildWidgetProps(
  data: WidgetData,
  {
    today,
    hideAmounts,
    colors,
  }: {
    today: DayKey;
    hideAmounts: boolean;
    colors: PaymentsWidgetProps['colors'];
  },
  l: Localizer,
): PaymentsWidgetProps {
  const { locale, t } = l;
  const month = monthOf(today);
  const first = firstDayOf(month);
  const last = lastDayOf(month);
  const accountsById = new Map(data.accounts.map((a) => [a.id, a]));

  const items = data.payments
    .map((p) => toPaymentItem(p, accountsById, today, l))
    .filter((p) => p.day >= first && p.day <= last)
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) || a.name.localeCompare(b.name, locale),
    );

  const marks = new Map<DayKey, WidgetDayMark>();
  const mark = (day: DayKey, value: WidgetDayMark) => {
    const current = marks.get(day) ?? 'none';
    if (MARK_RANK[value] > MARK_RANK[current]) marks.set(day, value);
  };
  for (const item of items) {
    if (item.status === 'skipped') continue;
    mark(
      item.day,
      item.overdue
        ? 'overdue'
        : item.status === 'paid'
          ? 'paid'
          : item.status === 'missed'
            ? 'overdue'
            : 'pending',
    );
  }
  for (const card of cardDatesIn(
    data.accounts,
    { start: first, end: last },
    t,
  )) {
    if (card.kind === 'payment') mark(card.day, 'card');
  }

  const cells = monthGridDays(month);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: WidgetDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(
      cells.slice(i, i + 7).map((day, index) =>
        day
          ? {
              key: day,
              label: String(parseDayKey(day).day),
              today: day === today,
              mark: marks.get(day) ?? 'none',
            }
          : { key: `pad-${i + index}`, label: '', today: false, mark: 'none' },
      ),
    );
  }

  const open = items.filter((p) => p.open);
  const fits =
    open.length > WIDGET_MAX_ROWS ? WIDGET_MAX_ROWS - 1 : WIDGET_MAX_ROWS;
  const shown = open.slice(0, fits);

  return {
    status: 'ready',
    monthLabel: monthLabel(month, locale),
    weekdays: weekdayInitials(locale),
    weeks,
    title: t('widget.pendingTitle'),
    payments: shown.map((p) => {
      const offset = daysBetween(today, p.day);
      const date = shortDate(p.day, locale);
      return {
        key: p.key,
        name: p.name,
        when:
          p.status === 'missed'
            ? t('finance.payment.missed', { date })
            : offset === 0
              ? t('widget.today')
              : offset === 1
                ? t('widget.tomorrow')
                : date,
        amount: hideAmounts ? HIDDEN_AMOUNT : p.amountLabel,
        color: kindColor(p.kind),
        overdue: p.status === 'missed',
      };
    }),
    moreLabel:
      open.length > shown.length
        ? t('widget.more', { count: open.length - shown.length })
        : '',
    emptyLabel: t('widget.empty'),
    message: '',
    url: WIDGET_URL,
    colors,
  };
}

/** What the widget shows without a session: no data at all. */
export function signedOutWidgetProps(
  colors: PaymentsWidgetProps['colors'],
  { t }: Localizer,
): PaymentsWidgetProps {
  return {
    status: 'signedOut',
    monthLabel: '',
    weekdays: [],
    weeks: [],
    title: t('widget.pendingTitle'),
    payments: [],
    moreLabel: '',
    emptyLabel: '',
    message: t('widget.signedOut'),
    url: WIDGET_URL,
    colors,
  };
}

/**
 * Mexico City has no daylight saving time since 2022: its midnight is
 * 06:00 UTC every day of the year.
 */
export function midnightOf(day: DayKey): Date {
  return new Date(`${day}T06:00:00.000Z`);
}

/** Days scheduled after the next month starts (in case the app isn't opened). */
export const TIMELINE_EXTRA_DAYS = 7;

/**
 * One entry now and one at every midnight until a week into next month
 * (the data covers both months), each built for its own "today".
 */
export function buildWidgetTimeline(
  data: WidgetData,
  {
    now,
    today,
    hideAmounts,
    colors,
  }: {
    now: Date;
    today: DayKey;
    hideAmounts: boolean;
    colors: PaymentsWidgetProps['colors'];
  },
  l: Localizer,
): { date: Date; props: PaymentsWidgetProps }[] {
  const end = addDays(
    firstDayOf(shiftMonth(monthOf(today), 1)),
    TIMELINE_EXTRA_DAYS - 1,
  );
  const entries = [
    {
      date: now,
      props: buildWidgetProps(data, { today, hideAmounts, colors }, l),
    },
  ];
  for (let day = addDays(today, 1); day <= end; day = addDays(day, 1)) {
    entries.push({
      date: midnightOf(day),
      props: buildWidgetProps(data, { today: day, hideAmounts, colors }, l),
    });
  }
  return entries;
}
