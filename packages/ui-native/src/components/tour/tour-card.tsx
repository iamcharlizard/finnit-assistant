import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';

import { TwPressable, TwView } from '../../lib/tw';
import { useElevation } from '../../theme/theme-root';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';
import { Text } from '../ui/text';
import type { TourLabels, TourStep } from './tour-context';

interface TourCardProps {
  step: TourStep;
  index: number;
  total: number;
  labels: TourLabels;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/** The tour's explanation: title, text, progress and its buttons. */
export function TourCard({
  step,
  index,
  total,
  labels,
  onNext,
  onBack,
  onSkip,
  onLayout,
  style,
}: TourCardProps) {
  const elevation = useElevation();
  const last = index === total - 1;
  return (
    // --popover is opaque in every palette (the glass ones too).
    <TwView
      onLayout={onLayout}
      accessibilityLiveRegion="polite"
      className="gap-3 rounded-card border border-glass-border bg-popover p-5"
      style={[elevation, style]}
    >
      <TwView className="flex-row items-start justify-between gap-3">
        <TwView className="flex-1 gap-1">
          <Text weight="medium" className="text-xs text-brand-ink">
            {labels.stepOf(index + 1, total)}
          </Text>
          <Text
            accessibilityRole="header"
            weight="bold"
            className="text-lg text-on-background"
          >
            {step.title}
          </Text>
        </TwView>
        <TwPressable
          accessibilityRole="button"
          accessibilityLabel={labels.skip}
          onPress={onSkip}
          hitSlop={8}
          className="-mr-2 -mt-1 size-9 items-center justify-center rounded-full active:bg-accent"
        >
          <Icon icon={X} size={18} color="--on-surface-variant" />
        </TwPressable>
      </TwView>
      <Text className="text-sm text-on-surface-variant">{step.body}</Text>
      <TwView className="flex-row items-center justify-between gap-2 pt-1">
        {/* Dots: where the user is in the tour. */}
        <TwView className="flex-row gap-1.5" accessibilityElementsHidden>
          {Array.from({ length: total }, (_, i) => (
            <TwView
              key={i}
              className={
                i === index
                  ? 'h-1.5 w-4 rounded-full bg-brand-ink'
                  : 'size-1.5 rounded-full bg-outline'
              }
            />
          ))}
        </TwView>
        <TwView className="flex-row gap-2">
          {index > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              label={labels.back}
              onPress={onBack}
            />
          ) : null}
          <Button
            size="sm"
            label={last ? labels.done : labels.next}
            onPress={onNext}
          />
        </TwView>
      </TwView>
    </TwView>
  );
}
