import type { LucideIcon } from 'lucide-react-native';

import { cn } from '@finnit/ui-native/lib/utils';
import { TwPressable, TwView } from '@finnit/ui-native/lib/tw';
import { Icon } from '@finnit/ui-native/components/ui/icon';
import { Sheet } from '@finnit/ui-native/components/ui/sheet';
import { Text } from '@finnit/ui-native/components/ui/text';

export interface DetailAction {
  key: string;
  label: string;
  icon: LucideIcon;
  run: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

/** The movement's "⋯": every action but "Editar", deleting last and in red. */
export function ActionsSheet({
  title,
  closeLabel,
  actions,
  onClose,
}: {
  title: string;
  closeLabel: string;
  actions: DetailAction[];
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(next) => !next && onClose()}
      title={title}
      closeLabel={closeLabel}
    >
      <TwView className="gap-1 pb-2">
        {actions.map((action) => (
          <TwPressable
            key={action.key}
            accessibilityRole="button"
            accessibilityState={{ disabled: action.disabled }}
            disabled={action.disabled}
            onPress={() => {
              onClose();
              action.run();
            }}
            className={cn(
              'min-h-12 flex-row items-center gap-3 rounded-xl px-3 active:bg-track',
              action.destructive && 'mt-2 border-t border-outline pt-2',
              action.disabled && 'opacity-50',
            )}
          >
            <Icon
              icon={action.icon}
              size={18}
              color={action.destructive ? '--expense' : undefined}
            />
            <Text
              weight="medium"
              className={cn('text-base', action.destructive && 'text-expense')}
            >
              {action.label}
            </Text>
          </TwPressable>
        ))}
      </TwView>
    </Sheet>
  );
}
