import type { LucideIcon } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Button } from './button';
import { Icon } from './icon';
import { Text } from './text';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
  className?: string;
}

/** Honest "nothing here yet" block, with an optional next step. */
function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <TwView
      className={cn(
        'items-center gap-2 rounded-card border border-dashed border-on-background-12 px-6 py-10',
        className,
      )}
    >
      <Icon icon={icon} size={40} color="--on-surface-variant-50" />
      <Text weight="medium" className="text-center text-base text-on-background">
        {title}
      </Text>
      {description ? (
        <Text className="text-center text-sm text-on-surface-variant">{description}</Text>
      ) : null}
      {action ? (
        <Button label={action.label} variant="secondary" size="sm" onPress={action.onPress} className="mt-2" />
      ) : null}
    </TwView>
  );
}

export { EmptyState, type EmptyStateProps };
