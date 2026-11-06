import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { useColor } from '../../theme/theme-root';
import { Text } from '../ui/text';

interface CategoryRow {
  id: string;
  label: string;
  percentage: string;
  dotColor: string;
}

/** The month's top categories with their share (@finnit/ui's PopularCategoriesCard). */
function PopularCategoriesCard({
  title = 'Popular categories',
  categories,
  className,
}: {
  title?: string;
  categories: ReadonlyArray<CategoryRow>;
  className?: string;
}) {
  const color = useColor();
  return (
    <TwView className={cn('rounded-card border border-glass-border bg-glass p-6', className)}>
      <Text accessibilityRole="header" weight="medium" className="mb-4 text-base">
        {title}
      </Text>
      <TwView className="gap-4">
        {categories.map((cat) => (
          <TwView key={cat.id} className="flex-row items-center justify-between">
            <TwView className="flex-row items-center gap-3">
              <TwView className="size-2 rounded-full" style={{ backgroundColor: color(cat.dotColor) }} />
              <Text className="text-sm">{cat.label}</Text>
            </TwView>
            <Text weight="medium" className="text-xs tracking-wide text-on-surface-variant">
              {cat.percentage}
            </Text>
          </TwView>
        ))}
      </TwView>
    </TwView>
  );
}

export { PopularCategoriesCard, type CategoryRow };
