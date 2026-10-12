'use client';

import { cn } from '../../lib/utils';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

interface FilterItem {
  value: string;
  label: string;
}

interface FilterChipGroupProps {
  items: ReadonlyArray<FilterItem>;
  activeValue: string;
  onSelect: (value: string) => void;
  'aria-label'?: string;
  className?: string;
}

function FilterChipGroup({
  items,
  activeValue,
  onSelect,
  'aria-label': ariaLabel = 'Filtros',
  className,
}: FilterChipGroupProps) {
  return (
    <ToggleGroup
      type="single"
      value={activeValue}
      // Radix emits '' when the active chip is pressed again; keep one selected.
      onValueChange={(value) => {
        if (value) onSelect(value);
      }}
      aria-label={ariaLabel}
      className={cn(
        'overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value}>
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export { FilterChipGroup, type FilterChipGroupProps, type FilterItem };
