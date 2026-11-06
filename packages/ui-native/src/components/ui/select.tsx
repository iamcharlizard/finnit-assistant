import * as React from 'react';
import { FlatList } from 'react-native';
import { Check, ChevronDown, Search } from 'lucide-react-native';

import { normalizeSearch } from '@finnit/core/text/option-search';

import { cn } from '../../lib/utils';
import { TwPressable, TwView } from '../../lib/tw';
import { Field, fieldBoxClass } from './field';
import { Icon } from './icon';
import { Input } from './input';
import { Sheet } from './sheet';
import { Text } from './text';

interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** A second line (e.g. the bank). */
  hint?: string;
}

interface SelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  /** Title of the options sheet (defaults to the label). */
  title?: string;
  /** Shows a search box (long lists: categories, accounts). */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  closeLabel?: string;
  disabled?: boolean;
  className?: string;
  /** "Add “text”" at the end of the search results (the web's Combobox onCreate). */
  onCreate?: (text: string) => void;
  createLabel?: (text: string) => string;
}

/**
 * The web's Select (and Combobox with `searchable`/`onCreate`): a field
 * that opens a sheet with the options.
 */
function Select<T extends string>({
  options,
  value,
  onValueChange,
  label,
  error,
  placeholder = '',
  title,
  searchable,
  searchPlaceholder,
  emptyLabel = '—',
  closeLabel,
  disabled,
  className,
  onCreate,
  createLabel,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const selected = options.find((o) => o.value === value);
  const needle = normalizeSearch(query);
  const shown = needle
    ? options.filter((o) => normalizeSearch(`${o.label} ${o.hint ?? ''}`).includes(needle))
    : options;
  const canCreate = Boolean(onCreate && query.trim() && !options.some((o) => normalizeSearch(o.label) === needle));

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <Field label={label} error={error}>
      <TwPressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selected?.label ?? placeholder}` : selected?.label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          fieldBoxClass({ focused: open, error, disabled }),
          'min-h-12 flex-row items-center gap-2 px-4',
          className,
        )}
      >
        <Text numberOfLines={1} className={cn('flex-1 text-base', selected ? 'text-on-background' : 'text-on-surface-variant')}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon icon={ChevronDown} size={18} color="--on-surface-variant" />
      </TwPressable>
      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())} title={title ?? label} closeLabel={closeLabel}>
        {searchable ? (
          <Input
            icon={Search}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            autoCorrect={false}
            className="mb-2"
          />
        ) : null}
        <FlatList
          data={shown}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 420 }}
          ListEmptyComponent={
            canCreate ? undefined : <Text className="py-6 text-center text-sm text-on-surface-variant">{emptyLabel}</Text>
          }
          ListFooterComponent={
            canCreate ? (
              <TwPressable
                accessibilityRole="button"
                onPress={() => {
                  onCreate!(query.trim());
                  close();
                }}
                className="min-h-12 justify-center rounded-chip px-3 active:bg-accent"
              >
                <Text weight="medium" className="text-base text-brand-ink">
                  {createLabel ? createLabel(query.trim()) : `+ ${query.trim()}`}
                </Text>
              </TwPressable>
            ) : undefined
          }
          renderItem={({ item }) => {
            const active = item.value === value;
            return (
              <TwPressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onValueChange(item.value);
                  close();
                }}
                className={cn('min-h-12 flex-row items-center gap-3 rounded-chip px-3 active:bg-accent', active && 'bg-primary-15')}
              >
                <TwView className="min-w-0 flex-1 py-2">
                  <Text weight={active ? 'medium' : 'regular'} className="text-base">
                    {item.label}
                  </Text>
                  {item.hint ? <Text className="text-xs text-on-surface-variant">{item.hint}</Text> : null}
                </TwView>
                {active ? <Icon icon={Check} size={18} color="--brand-ink" /> : null}
              </TwPressable>
            );
          }}
        />
      </Sheet>
    </Field>
  );
}

export { Select, type SelectOption, type SelectProps };
