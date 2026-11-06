import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';

function Separator({
  orientation = 'horizontal',
  className,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}) {
  return (
    <TwView
      accessibilityElementsHidden
      importantForAccessibility="no"
      className={cn(
        'shrink-0 bg-outline',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  );
}

export { Separator };
