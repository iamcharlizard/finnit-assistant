import { cn } from '../../lib/utils';

interface CategoryRow {
  id: string;
  label: string;
  percentage: string;
  dotColor: string;
}

interface PopularCategoriesCardProps {
  title?: string;
  categories: ReadonlyArray<CategoryRow>;
  className?: string;
}

function PopularCategoriesCard({
  title = 'Popular categories',
  categories,
  className,
}: PopularCategoriesCardProps) {
  return (
    <section
      className={cn(
        'rounded-card border border-glass-border bg-glass p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-md',
        className,
      )}
    >
      <h3 className="mb-4 text-base font-medium text-on-background">{title}</h3>
      <ul className="flex flex-col gap-4">
        {categories.map((cat) => (
          <li key={cat.id} className="flex items-center justify-between">
            <span className="flex items-center gap-3 text-sm text-on-background">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: cat.dotColor }}
              />
              {cat.label}
            </span>
            <span className="text-xs font-medium tracking-wide text-on-surface-variant">
              {cat.percentage}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export {
  PopularCategoriesCard,
  type PopularCategoriesCardProps,
  type CategoryRow,
};
