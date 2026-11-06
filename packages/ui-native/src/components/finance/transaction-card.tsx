import * as React from 'react';
import { ActivityIndicator } from 'react-native';
import { Lock, Pencil, type LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwTextInput, TwView } from '../../lib/tw';
import { useToken } from '../../theme/theme-root';
import { Checkbox } from '../ui/checkbox';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';

type CardVariant = 'income' | 'expense' | 'pending' | 'failed';
type CardStatusVariant = 'completado' | 'info' | 'pendiente' | 'fallida';

interface TransactionCardRename {
  editLabel: string;
  inputLabel: string;
  maxLength?: number;
  /** The name to edit, when it isn't the one shown. */
  value?: string;
  onSave: (name: string) => Promise<void>;
}

interface TransactionCardProps {
  merchant: string;
  category: string;
  time: string;
  amount: string;
  icon: LucideIcon;
  variant: CardVariant;
  status?: { label: string; variant: CardStatusVariant };
  onOpen?: () => void;
  openLabel?: string;
  isPrivate?: boolean;
  privateLabel?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
  selectLabel?: string;
  /** The pencil next to the name edits it right in the card. */
  rename?: TransactionCardRename;
  footer?: React.ReactNode;
  className?: string;
}

const ICON_BG: Record<CardVariant, string> = {
  income: 'bg-income-10 dark:bg-income-20',
  pending: 'bg-track',
  expense: 'bg-expense-8 dark:bg-expense-15',
  failed: 'bg-expense-8 dark:bg-expense-15',
};

const AMOUNT_COLOR: Record<CardVariant, string> = {
  income: 'text-income',
  pending: 'text-on-surface-variant',
  expense: 'text-expense',
  failed: 'text-expense',
};

const STATUS_COLOR: Record<CardStatusVariant, string> = {
  completado: 'text-income',
  info: 'text-on-surface-variant',
  pendiente: 'text-on-surface-variant',
  fallida: 'text-expense',
};

/**
 * A movement as a card (@finnit/ui's TransactionCard): icon, name,
 * category and time, amount and status. The whole card opens the
 * movement; the checkbox, the pencil and the footer do their own thing.
 */
function TransactionCard({
  merchant,
  category,
  time,
  amount,
  icon,
  variant,
  status,
  onOpen,
  openLabel,
  isPrivate,
  privateLabel = 'Private',
  selectable,
  selected = false,
  onSelectedChange,
  selectLabel,
  rename,
  footer,
  className,
}: TransactionCardProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const muted = useToken('--on-surface-variant');

  function startEditing() {
    if (!rename) return;
    setDraft(rename.value ?? merchant);
    setFailed(false);
    setEditing(true);
  }

  async function commit() {
    if (!rename || saving) return;
    const next = draft.trim();
    if (next === (rename.value ?? merchant).trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await rename.onSave(next);
      setEditing(false);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TwPressable
      accessibilityRole={onOpen ? 'button' : undefined}
      accessibilityLabel={openLabel ?? merchant}
      accessibilityState={selectable ? { selected } : undefined}
      onPress={onOpen}
      disabled={!onOpen || editing}
      className={cn(
        'rounded-2xl bg-surface active:bg-accent',
        selected && 'border-2 border-ring-60',
        className,
      )}
    >
      <TwView className="min-h-11 flex-row items-center gap-3 p-4">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange?.(checked)}
            label={selectLabel ?? merchant}
            hideLabel
            className="-my-2 -ml-2 min-w-11 justify-center"
          />
        ) : null}
        <TwView className={cn('size-12 shrink-0 items-center justify-center rounded-chip', ICON_BG[variant])}>
          <Icon icon={icon} size={22} color="--on-surface-variant" />
        </TwView>
        <TwView className="min-w-0 flex-1">
          {editing && rename ? (
            <TwView className="flex-row items-center gap-2">
              <TwTextInput
                autoFocus
                value={draft}
                maxLength={rename.maxLength}
                accessibilityLabel={rename.inputLabel}
                editable={!saving}
                selectTextOnFocus
                returnKeyType="done"
                onChangeText={(text) => {
                  setDraft(text);
                  setFailed(false);
                }}
                onSubmitEditing={() => void commit()}
                onBlur={() => void commit()}
                className={cn(
                  'min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 font-ubuntu-medium text-sm leading-none text-on-background',
                  failed ? 'border-expense' : 'border-outline',
                )}
              />
              {saving ? <ActivityIndicator size="small" color={muted} /> : null}
            </TwView>
          ) : (
            <TwView className="flex-row items-center gap-1">
              {isPrivate ? (
                <TwView accessible accessibilityLabel={privateLabel}>
                  <Icon icon={Lock} size={14} color="--on-surface-variant" />
                </TwView>
              ) : null}
              <Text weight="medium" numberOfLines={1} className="shrink text-sm text-on-background">
                {merchant}
              </Text>
              {rename ? (
                <TwPressable
                  accessibilityRole="button"
                  accessibilityLabel={rename.editLabel}
                  hitSlop={8}
                  onPress={startEditing}
                  className="size-7 shrink-0 items-center justify-center rounded-full active:bg-track"
                >
                  <Icon icon={Pencil} size={14} color="--on-surface-variant" />
                </TwPressable>
              ) : null}
            </TwView>
          )}
          <Text numberOfLines={1} className="mt-0.5 text-xs text-on-surface-variant">
            {category} · {time}
          </Text>
        </TwView>
        <TwView className="ml-2 shrink-0 items-end">
          <Text weight="bold" className={cn('text-sm', AMOUNT_COLOR[variant])}>
            {amount}
          </Text>
          {status ? <Text className={cn('mt-0.5 text-[11px]', STATUS_COLOR[status.variant])}>{status.label}</Text> : null}
        </TwView>
      </TwView>
      {footer ? <TwView className="px-4 pb-4">{footer}</TwView> : null}
    </TwPressable>
  );
}

export { TransactionCard, type CardStatusVariant, type CardVariant, type TransactionCardProps, type TransactionCardRename };
