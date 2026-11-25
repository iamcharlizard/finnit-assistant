import {
  Circle,
  HStack,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { PaymentsWidgetProps } from '@finnit/core/widget/view';

/**
 * "Calendario y pagos" (medium home screen widget): this month on the left,
 * the payments still to make on the right, in due order. It only draws
 * the props the app sends (`lib/widget/sync.ts`): the widget runtime
 * can't fetch, format or import anything, so every constant lives inside
 * the function.
 */
const PaymentsCalendar = (
  props: PaymentsWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  const c =
    environment.colorScheme === 'dark' ? props.colors.dark : props.colors.light;
  const CELL = 17;
  const markColor = (mark: string) =>
    mark === 'overdue'
      ? c.overdue
      : mark === 'pending'
        ? c.pending
        : mark === 'paid'
          ? c.paid
          : mark === 'card'
            ? c.card
            : c.text;

  if (props.status === 'signedOut') {
    return (
      <VStack
        spacing={6}
        modifiers={[
          containerBackground(c.background, 'widget'),
          widgetURL(props.url),
        ]}
      >
        <Text
          modifiers={[
            font({ size: 13, weight: 'semibold' }),
            foregroundStyle(c.text),
          ]}
        >
          Finnit
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(c.muted)]}>
          {props.message}
        </Text>
      </VStack>
    );
  }

  return (
    <HStack
      spacing={14}
      alignment="top"
      modifiers={[
        containerBackground(c.background, 'widget'),
        widgetURL(props.url),
      ]}
    >
      {/* The month: today in a filled circle, days with payments in their color. */}
      <VStack alignment="leading" spacing={1}>
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            foregroundStyle(c.text),
            lineLimit(1),
            padding({ bottom: 2 }),
          ]}
        >
          {props.monthLabel}
        </Text>
        <HStack spacing={0}>
          {props.weekdays.map((day, i) => (
            <Text
              key={`w${i}`}
              modifiers={[
                font({ size: 8, weight: 'medium' }),
                foregroundStyle(c.muted),
                frame({ width: CELL, height: 11 }),
              ]}
            >
              {day}
            </Text>
          ))}
        </HStack>
        {props.weeks.map((week, w) => (
          <HStack key={`r${w}`} spacing={0}>
            {week.map((day) => (
              <ZStack
                key={day.key}
                modifiers={[frame({ width: CELL, height: 15 })]}
              >
                {day.today ? (
                  <Circle
                    modifiers={[
                      foregroundStyle(c.accent),
                      frame({ width: 15, height: 15 }),
                    ]}
                  />
                ) : null}
                <Text
                  modifiers={[
                    font({
                      size: 9,
                      weight:
                        day.today || day.mark !== 'none' ? 'bold' : 'regular',
                    }),
                    foregroundStyle(
                      day.today ? c.accentText : markColor(day.mark),
                    ),
                    monospacedDigit(),
                  ]}
                >
                  {day.label}
                </Text>
              </ZStack>
            ))}
          </HStack>
        ))}
      </VStack>

      {/* What's left to pay this month, the soonest first. */}
      <VStack
        alignment="leading"
        spacing={5}
        modifiers={[frame({ maxWidth: 1000, alignment: 'topLeading' })]}
      >
        <Text
          modifiers={[
            font({ size: 11, weight: 'semibold' }),
            foregroundStyle(c.muted),
            lineLimit(1),
          ]}
        >
          {props.title}
        </Text>
        {props.payments.length === 0 ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(c.muted)]}>
            {props.emptyLabel}
          </Text>
        ) : null}
        {props.payments.map((payment) => (
          <HStack key={payment.key} spacing={6} alignment="center">
            <Circle
              modifiers={[
                foregroundStyle(payment.color),
                frame({ width: 6, height: 6 }),
              ]}
            />
            <VStack alignment="leading" spacing={0}>
              <Text
                modifiers={[
                  font({ size: 11, weight: 'medium' }),
                  foregroundStyle(c.text),
                  lineLimit(1),
                ]}
              >
                {payment.name}
              </Text>
              <Text
                modifiers={[
                  font({ size: 9 }),
                  foregroundStyle(payment.overdue ? c.overdue : c.muted),
                  lineLimit(1),
                ]}
              >
                {payment.when}
              </Text>
            </VStack>
            <Spacer />
            <Text
              modifiers={[
                font({ size: 11, weight: 'semibold' }),
                foregroundStyle(c.text),
                monospacedDigit(),
                lineLimit(1),
              ]}
            >
              {payment.amount}
            </Text>
          </HStack>
        ))}
        {props.moreLabel ? (
          <Text
            modifiers={[
              font({ size: 9, weight: 'medium' }),
              foregroundStyle(c.muted),
            ]}
          >
            {props.moreLabel}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  );
};

/** Before the app first syncs (also the widget gallery's preview). */
const PLACEHOLDER: PaymentsWidgetProps = {
  status: 'signedOut',
  monthLabel: '',
  weekdays: [],
  weeks: [],
  title: '',
  payments: [],
  moreLabel: null,
  emptyLabel: '',
  message: 'Abre Finnit para ver tus pagos del mes.',
  url: 'finnitapp:///calendar',
  colors: {
    light: {
      background: '#ffffff',
      text: '#1a1b22',
      muted: '#5c6370',
      accent: '#00696e',
      accentText: '#f8f9fa',
      pending: '#00696e',
      overdue: '#ba1a1a',
      paid: '#006688',
      card: '#5b61c2',
    },
    dark: {
      background: '#1a1b22',
      text: '#e3e2e6',
      muted: '#a9adb8',
      accent: '#4fd8de',
      accentText: '#12131a',
      pending: '#4fd8de',
      overdue: '#ffb4ab',
      paid: '#7fd0f0',
      card: '#bfc2ff',
    },
  },
};

export default createWidget('PaymentsCalendar', PaymentsCalendar, PLACEHOLDER);
