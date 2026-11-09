import { useTranslations } from 'use-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  CreditCard,
  type LucideIcon,
} from 'lucide-react-native';

import type { EntryKind } from '@finnit/core/new-entry/form';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

type PickedKind = EntryKind | 'cardPayment';

const KINDS: readonly {
  kind: PickedKind;
  icon: LucideIcon;
  tone: `--${string}`;
}[] = [
  { kind: 'expense', icon: CircleArrowUp, tone: '--expense' },
  { kind: 'income', icon: CircleArrowDown, tone: '--income' },
  { kind: 'transfer', icon: ArrowLeftRight, tone: '--violet-ink' },
  { kind: 'cardPayment', icon: CreditCard, tone: '--violet-ink' },
];

/**
 * Step 1: gasto, ingreso, transferencia or, with a credit card registered,
 * pago a tarjeta (a transfer into a card).
 */
export function EntryKindPicker({
  onPick,
  withCardPayment,
}: {
  onPick: (kind: PickedKind) => void;
  withCardPayment: boolean;
}) {
  const t = useTranslations('newEntry');
  return (
    <TwView className="gap-2">
      {KINDS.filter(
        ({ kind }) => kind !== 'cardPayment' || withCardPayment,
      ).map(({ kind, icon, tone }) => (
        <TwPressable
          key={kind}
          accessibilityRole="button"
          onPress={() => onPick(kind)}
          className="min-h-20 flex-row items-center gap-3 rounded-xl bg-track p-4 active:bg-accent"
        >
          <Icon icon={icon} size={24} color={tone} />
          <TwView className="flex-1">
            <Text weight="medium" className="text-sm">
              {t(kind)}
            </Text>
            <Text className="text-[11px] text-on-surface-variant">
              {t(`kindHints.${kind}`)}
            </Text>
          </TwView>
        </TwPressable>
      ))}
    </TwView>
  );
}
