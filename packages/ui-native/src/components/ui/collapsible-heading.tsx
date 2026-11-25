import type * as React from 'react';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Icon } from './icon';
import { Text } from './text';

interface CollapsibleHeadingProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  /** At the end, e.g. "Ver todas" (it doesn't toggle). */
  action?: React.ReactNode;
  /** `lg`: a section's heading (like SectionHeading); `base`: inside a card. */
  size?: 'lg' | 'base';
  className?: string;
}

/**
 * A section's heading that folds its content: the title and a chevron
 * toggle it (the chevron points down while open), the action stays apart.
 * The parent renders the content only while `collapsed` is false.
 */
function CollapsibleHeading({
  title,
  collapsed,
  onToggle,
  action,
  size = 'lg',
  className,
}: CollapsibleHeadingProps) {
  const turn = useDerivedValue(() =>
    withTiming(collapsed ? -90 : 0, { duration: 200 }),
  );
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value}deg` }],
  }));
  return (
    <TwView
      className={cn(
        'flex-row items-center justify-between gap-2',
        size === 'lg' ? 'mb-3 px-1' : 'px-3',
        className,
      )}
    >
      <TwPressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: !collapsed }}
        onPress={onToggle}
        hitSlop={8}
        className="min-h-11 flex-1 flex-row items-center gap-1.5 active:opacity-70"
      >
        <Text
          accessibilityRole="header"
          weight="bold"
          className={cn(
            'text-on-background',
            size === 'lg' ? 'text-lg' : 'text-base',
          )}
        >
          {title}
        </Text>
        <Animated.View style={chevronStyle}>
          <Icon icon={ChevronDown} size={18} color="--on-surface-variant" />
        </Animated.View>
      </TwPressable>
      {action}
    </TwView>
  );
}

export { CollapsibleHeading, type CollapsibleHeadingProps };
