import { Platform } from 'react-native';
import type { Client } from 'urql';
import { createTranslator } from 'use-intl/core';

import { TIME_ZONE, todayKey } from '@finnit/core/finance/dates';
import type { Locale } from '@finnit/core/i18n/locales';
import type { Localizer, Translate } from '@finnit/core/i18n/translator';
import en from '@finnit/core/messages/en.json';
import es from '@finnit/core/messages/es.json';
import { parseHideAmounts } from '@finnit/core/privacy/amounts';
import { isAppTheme } from '@finnit/core/theme/app-theme';
import {
  WIDGET_QUERY,
  widgetData,
  widgetVariables,
  type WidgetResult,
} from '@finnit/core/widget/request';
import {
  buildWidgetTimeline,
  glassGradient,
  signedOutWidgetProps,
  type PaymentsWidgetProps,
  type WidgetColors,
} from '@finnit/core/widget/view';
import { THEMES } from '@finnit/ui-native/theme/tokens';

import { initialLocale } from '@/lib/i18n/i18n-provider';
import { readItem } from '@/lib/session/storage';
import { APP_THEME } from '@/lib/theme/app-theme';

type PaymentsWidget = typeof import('@/widgets/payments-calendar').default;

/**
 * The widget module only exists on iOS (WidgetKit): it is loaded lazily so
 * Android and the web never touch the native module.
 */
let widget: PaymentsWidget | null | undefined;
function paymentsWidget(): PaymentsWidget | null {
  if (widget !== undefined) return widget;
  if (Platform.OS !== 'ios') return (widget = null);
  try {
    widget = (
      require('@/widgets/payments-calendar') as { default: PaymentsWidget }
    ).default;
  } catch {
    // A build without the widget extension (e.g. Expo Go).
    widget = null;
  }
  return widget;
}

const MESSAGES = { es, en } as const;

/** The app's texts outside React (the background task has no providers). */
function localizer(): Localizer {
  const locale: Locale = initialLocale();
  const t = createTranslator({
    locale,
    messages: MESSAGES[locale],
    timeZone: TIME_ZONE,
  }) as unknown as Translate;
  return { locale, t };
}

/**
 * The palette in use on this device, light and dark. The widget picks one
 * by the system's mode; when the app is set to Claro or Oscuro, both carry
 * that mode's colors, so the widget matches the app.
 */
function widgetColors(): PaymentsWidgetProps['colors'] {
  const saved = readItem('themePreview');
  const theme = isAppTheme(saved) ? saved : APP_THEME;
  const pick = (scheme: 'light' | 'dark'): WidgetColors => {
    const { tokens, blobs } = THEMES[theme][scheme];
    const token = (name: `--${string}`, fallback: string) =>
      tokens[name] ?? fallback;
    // Glass: its blobs over its background, like the app behind the cards.
    const gradient = glassGradient(token('--background', '#ffffff'), blobs);
    return {
      // --popover is opaque in every palette (--card isn't in Glass).
      background: gradient.length
        ? token('--background', '#ffffff')
        : token('--popover', scheme === 'dark' ? '#1a1b22' : '#ffffff'),
      gradient,
      text: token('--on-background', scheme === 'dark' ? '#e3e2e6' : '#1a1b22'),
      muted: token('--on-surface-variant', '#5c6370'),
      accent: token('--brand-ink', '#00696e'),
      accentText: token(
        '--background',
        scheme === 'dark' ? '#12131a' : '#f8f9fa',
      ),
      pending: token('--brand-ink', '#00696e'),
      overdue: token('--expense', '#ba1a1a'),
      paid: token('--income', '#006688'),
      card: token('--violet-ink', '#5b61c2'),
    };
  };
  const appearance = readItem('appearance');
  if (appearance === 'light' || appearance === 'dark') {
    const fixed = pick(appearance);
    return { light: fixed, dark: fixed };
  }
  return { light: pick('light'), dark: pick('dark') };
}

/** Without a session the widget shows no data at all. */
export function clearWidget() {
  try {
    paymentsWidget()?.updateSnapshot(
      signedOutWidgetProps(widgetColors(), localizer()),
    );
  } catch {
    // The widget is optional: never break signing out.
  }
}

/**
 * Loads this month's and next month's payments and schedules the widget's
 * days (one entry per midnight). Returns false when nothing was updated
 * (no widget, no session, offline).
 */
export async function syncWidget(client: Client): Promise<boolean> {
  const target = paymentsWidget();
  if (!target) return false;
  if (!readItem('accessToken')) {
    clearWidget();
    return true;
  }
  const today = todayKey();
  const result = await client
    .query<WidgetResult>(WIDGET_QUERY, widgetVariables(today), {
      requestPolicy: 'network-only',
    })
    .toPromise();
  if (!result.data) return false;
  const entries = buildWidgetTimeline(
    widgetData(result.data),
    {
      now: new Date(),
      today,
      hideAmounts: parseHideAmounts(readItem('hideAmounts')),
      colors: widgetColors(),
    },
    localizer(),
  );
  try {
    target.updateTimeline(entries);
  } catch {
    // The widget is optional: a failure here must never close the app.
    return false;
  }
  return true;
}

/*
 * Anything that changes what the widget shows (a payment marked, "Ocultar
 * montos", the palette) asks for a sync here.
 */
const syncListeners = new Set<() => void>();
export function requestWidgetSync() {
  syncListeners.forEach((listener) => listener());
}

export function onWidgetSyncRequest(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}
