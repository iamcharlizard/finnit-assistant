import { useTranslations } from 'use-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Text } from '@finnit/ui-native/components/ui/text';

/** ‹ Noviembre 2026 › (the web's MonthSwitcher, with callbacks instead of links). */
export function MonthSwitcher({
  label,
  onPrevious,
  onNext,
  compact = false,
}: {
  label: string;
  onPrevious: () => void;
  /** null: no later month (the current one). */
  onNext: (() => void) | null;
  compact?: boolean;
}) {
  const t = useTranslations('monthSwitcher');
  const arrow = 'size-11 items-center justify-center rounded-full active:bg-accent';
  return (
    <TwView accessibilityLabel={t('label')} className="flex-row items-center gap-1">
      <TwPressable accessibilityRole="button" accessibilityLabel={t('previous')} onPress={onPrevious} className={arrow}>
        <Icon icon={ChevronLeft} size={20} />
      </TwPressable>
      <Text
        accessibilityRole="header"
        weight="bold"
        className={cn('text-center capitalize', compact ? 'min-w-32 text-base' : 'min-w-40 text-xl')}
      >
        {label}
      </Text>
      {onNext ? (
        <TwPressable accessibilityRole="button" accessibilityLabel={t('next')} onPress={onNext} className={arrow}>
          <Icon icon={ChevronRight} size={20} />
        </TwPressable>
      ) : (
        <TwView className="size-11" />
      )}
    </TwView>
  );
}
