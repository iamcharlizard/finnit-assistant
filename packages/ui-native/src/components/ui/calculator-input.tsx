import * as React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Delete } from 'lucide-react-native';

import {
  amountText,
  calcTokens,
  evaluateCalc,
  expressionFromAmount,
  hasOperation,
  pressCalcKey,
  type CalcKey,
  type CalcOperator,
} from '@finnit/core/finance/calculator';
import {
  completeMoneyValue,
  formatMoneyText,
  normalizeMoneyValue,
  type MoneyFormat,
} from '@finnit/core/format/money-format';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Field } from './field';
import { Icon } from './icon';
import { useMoneyFormat } from './money-input';
import { Text } from './text';

export interface CalculatorLabels {
  /** Hint of the field: what a tap does. */
  open: string;
  done: string;
  clear: string;
  backspace: string;
  plus: string;
  minus: string;
  times: string;
  divide: string;
  equals: string;
  decimal: string;
  /** Below the result when the operation has no amount (÷ 0, below zero). */
  invalid: string;
}

const DEFAULT_LABELS: CalculatorLabels = {
  open: 'Open the calculator',
  done: 'Done',
  clear: 'Clear',
  backspace: 'Delete',
  plus: 'Plus',
  minus: 'Minus',
  times: 'Times',
  divide: 'Divided by',
  equals: 'Equals',
  decimal: 'Decimal point',
  invalid: 'Check the operation',
};

const GLYPH: Record<CalcOperator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

/** "1250.5+3*2" → "1,250.5 + 3 × 2", in the country's format. */
function expressionText(expression: string, format: MoneyFormat): string {
  return calcTokens(expression)
    .map((token) =>
      token.kind === 'number'
        ? formatMoneyText(token.text, format)
        : ` ${GLYPH[token.operator]} `,
    )
    .join('');
}

/** A result as the form's raw value, with the currency's cents ("190" → "190.00"). */
function committedValue(result: number, format: MoneyFormat): string {
  const rounded = format.decimals === 0 ? Math.round(result) : result;
  return completeMoneyValue(
    normalizeMoneyValue(amountText(rounded), format.decimals),
    format.decimals,
  );
}

interface CalculatorInputProps {
  label?: string;
  error?: string;
  /** Raw value: digits and "." for cents ("1250.50"); "" when empty. */
  value: string;
  onValueChange: (value: string) => void;
  /** Currency of the amount when it isn't the format's (e.g. an account in USD). */
  currency?: string;
  placeholder?: string;
  /** Open the keypad as soon as it shows (like autoFocus). */
  autoOpen?: boolean;
  /** After "Done" closed the keypad with an amount: e.g. go to the next field. */
  onDone?: () => void;
  /** On every key: e.g. a light haptic. */
  onKeyPress?: () => void;
  labels?: Partial<CalculatorLabels>;
  disabled?: boolean;
  className?: string;
}

/**
 * An amount typed on its own calculator keypad instead of the system
 * keyboard: digits, + − × ÷ and =, with the result shown as you type.
 * "Done" (or a tap outside) keeps the result; the value stays raw
 * ("1250.50") like MoneyInput's.
 */
function CalculatorInput({
  label,
  error,
  value,
  onValueChange,
  currency,
  placeholder,
  autoOpen,
  onDone,
  onKeyPress,
  labels: labelsProp,
  disabled,
  className,
}: CalculatorInputProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const format = useMoneyFormat(currency);
  const insets = useSafeAreaInsets();
  const [open, setOpen] = React.useState(false);
  const [expression, setExpression] = React.useState('');
  const doneRef = React.useRef(false);

  const show = React.useCallback(() => {
    if (disabled) return;
    setExpression(expressionFromAmount(value));
    setOpen(true);
  }, [disabled, value]);

  // Opens once, after the screen has settled (a modal can't show mid-transition).
  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    const timer = setTimeout(show, 350);
    return () => clearTimeout(timer);
  }, [autoOpen, show]);

  const result = evaluateCalc(expression);
  const invalid = expression !== '' && result === null;

  /** Keeps the result (or clears the amount) and closes; an invalid operation keeps the old value. */
  function close(done: boolean) {
    if (expression === '') onValueChange('');
    else if (result !== null) onValueChange(committedValue(result, format));
    doneRef.current = done && expression !== '' && result !== null;
    setOpen(false);
  }

  function press(key: CalcKey) {
    onKeyPress?.();
    setExpression((current) => pressCalcKey(current, key));
  }

  const prefix = format.symbolPosition === 'prefix';
  const shown = open
    ? expressionText(expression, format)
    : formatMoneyText(normalizeMoneyValue(value, format.decimals), format);
  const placeholderText =
    placeholder ??
    formatMoneyText(completeMoneyValue('0', format.decimals), format);
  const symbol = (
    <Text
      importantForAccessibility="no"
      className="text-title-lg text-on-surface-variant"
    >
      {format.symbol}
    </Text>
  );

  return (
    <Field label={label} error={error}>
      <TwPressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: shown || placeholderText }}
        accessibilityHint={error ?? labels.open}
        disabled={disabled}
        onPress={show}
        className={cn(
          'min-h-14 flex-row items-center gap-2 rounded-input border border-input bg-surface px-4',
          open && 'border-ring',
          error && 'border-expense',
          disabled && 'opacity-50',
          className,
        )}
      >
        {prefix ? symbol : null}
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          className={cn(
            'min-w-0 flex-1 text-[22px]',
            shown ? 'text-on-background' : 'text-on-surface-variant-60',
          )}
          style={{ lineHeight: 30, fontVariant: ['tabular-nums'] }}
        >
          {shown || placeholderText}
        </Text>
        {!prefix ? symbol : null}
        <TwView className="rounded-chip bg-track px-2 py-1">
          <Text weight="medium" className="text-xs text-on-surface-variant">
            {format.currency}
          </Text>
        </TwView>
      </TwPressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => close(false)}
        onDismiss={() => {
          if (doneRef.current) onDone?.();
          doneRef.current = false;
        }}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          accessibilityLabel={labels.done}
          onPress={() => close(false)}
        />
        <View style={styles.end} pointerEvents="box-none">
          <TwView
            accessibilityViewIsModal
            className="gap-3 rounded-t-[28px] bg-popover px-4 pt-4"
            style={{ paddingBottom: Math.max(16, insets.bottom) }}
          >
            {/* The operation and its result as you type. */}
            <TwView
              className="min-h-16 items-end justify-end px-2"
              accessibilityLiveRegion="polite"
            >
              <Text
                numberOfLines={1}
                className="text-sm text-on-surface-variant"
              >
                {hasOperation(expression)
                  ? expressionText(expression, format)
                  : ' '}
              </Text>
              <Text
                weight="bold"
                numberOfLines={1}
                adjustsFontSizeToFit
                className={cn(
                  'text-[32px]',
                  invalid ? 'text-expense' : 'text-on-background',
                )}
                style={{ lineHeight: 40, fontVariant: ['tabular-nums'] }}
              >
                {invalid
                  ? labels.invalid
                  : `${prefix ? format.symbol : ''}${formatMoneyText(
                      result === null ? '0' : amountText(result),
                      format,
                    )}${prefix ? '' : ` ${format.symbol}`}`}
              </Text>
            </TwView>
            <Keypad
              decimalSeparator={format.decimalSeparator}
              allowDecimals={format.decimals > 0}
              labels={labels}
              onKey={press}
              onDone={() => {
                onKeyPress?.();
                if (!invalid) close(true);
              }}
            />
          </TwView>
        </View>
      </Modal>
    </Field>
  );
}

type KeySpec =
  | { key: CalcKey; text?: string; label?: string; tone?: 'operator' | 'plain' }
  | { done: true };

function Keypad({
  decimalSeparator,
  allowDecimals,
  labels,
  onKey,
  onDone,
}: {
  decimalSeparator: string;
  allowDecimals: boolean;
  labels: CalculatorLabels;
  onKey: (key: CalcKey) => void;
  onDone: () => void;
}) {
  const op = (key: CalcOperator, label: string): KeySpec => ({
    key,
    text: GLYPH[key],
    label,
    tone: 'operator',
  });
  const rows: KeySpec[][] = [
    [{ key: '7' }, { key: '8' }, { key: '9' }, op('/', labels.divide)],
    [{ key: '4' }, { key: '5' }, { key: '6' }, op('*', labels.times)],
    [{ key: '1' }, { key: '2' }, { key: '3' }, op('-', labels.minus)],
    [
      { key: '.', text: decimalSeparator, label: labels.decimal },
      { key: '0' },
      { key: 'back', label: labels.backspace },
      op('+', labels.plus),
    ],
    [
      { key: 'clear', text: 'C', label: labels.clear, tone: 'operator' },
      { key: '=', text: '=', label: labels.equals, tone: 'operator' },
      { done: true },
    ],
  ];
  return (
    <TwView className="gap-2">
      {rows.map((row, r) => (
        <TwView key={r} className="flex-row gap-2">
          {row.map((spec) => {
            if ('done' in spec) {
              return (
                <TwPressable
                  key="done"
                  accessibilityRole="button"
                  accessibilityLabel={labels.done}
                  onPress={onDone}
                  className="h-14 flex-[2] items-center justify-center rounded-2xl bg-primary active:opacity-80"
                >
                  <Text
                    weight="bold"
                    className="text-base text-primary-foreground"
                  >
                    {labels.done}
                  </Text>
                </TwPressable>
              );
            }
            const disabled = spec.key === '.' && !allowDecimals;
            return (
              <TwPressable
                key={spec.key}
                accessibilityRole="button"
                accessibilityLabel={spec.label ?? spec.text ?? spec.key}
                disabled={disabled}
                onPress={() => onKey(spec.key)}
                className={cn(
                  'h-14 flex-1 items-center justify-center rounded-2xl active:opacity-70',
                  spec.tone === 'operator' ? 'bg-primary-15' : 'bg-track',
                  disabled && 'opacity-30',
                )}
              >
                {spec.key === 'back' ? (
                  <Icon icon={Delete} size={24} color="--on-background" />
                ) : (
                  <Text
                    weight={spec.tone === 'operator' ? 'bold' : 'medium'}
                    className={cn(
                      'text-[24px]',
                      spec.tone === 'operator'
                        ? 'text-brand-ink'
                        : 'text-on-background',
                    )}
                    style={{ lineHeight: 30 }}
                  >
                    {spec.text ?? spec.key}
                  </Text>
                )}
              </TwPressable>
            );
          })}
        </TwView>
      ))}
    </TwView>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  end: { flex: 1, justifyContent: 'flex-end' },
});

export { CalculatorInput, type CalculatorInputProps };
