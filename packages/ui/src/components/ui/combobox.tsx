'use client';

import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon, type LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface ComboboxOption {
  value: string;
  label: string;
  /** Group heading (e.g. the parent category). Options keep their order inside each group. */
  group?: string;
  icon?: LucideIcon;
  /** Extra text matched by the search (e.g. aliases). */
  keywords?: string[];
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Allow choosing the selected option again to clear it. */
  clearable?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
}

interface OptionGroup {
  heading: string | undefined;
  options: ComboboxOption[];
}

function groupOptions(options: ComboboxOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  const byHeading = new Map<string | undefined, OptionGroup>();
  for (const option of options) {
    let group = byHeading.get(option.group);
    if (!group) {
      group = { heading: option.group, options: [] };
      byHeading.set(option.group, group);
      groups.push(group);
    }
    group.options.push(option);
  }
  return groups;
}

function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  clearable = false,
  disabled,
  label,
  error,
  id,
  name,
  'aria-label': ariaLabel,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const errorId = `${triggerId}-error`;

  const selected = options.find((option) => option.value === value);
  const groups = React.useMemo(() => groupOptions(options), [options]);
  const SelectedIcon = selected?.icon;

  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={triggerId}
          type="button"
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          data-slot="combobox-trigger"
          className={cn(
            'flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-input border border-input bg-surface px-4 py-3 text-left text-body-md text-on-background outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
            'aria-invalid:border-expense aria-invalid:ring-expense/20',
            !selected && 'text-on-surface-variant',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {SelectedIcon ? (
              <SelectedIcon
                aria-hidden
                className="size-4 shrink-0 text-on-surface-variant"
              />
            ) : null}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronsUpDownIcon
            aria-hidden
            className="size-4 shrink-0 text-on-surface-variant"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.heading ?? ''} heading={group.heading}>
                {group.options.map((option) => {
                  const Icon = option.icon;
                  const isSelected = option.value === value;
                  return (
                    <CommandItem
                      key={option.value}
                      // cmdk filters on `value`; include the label and group so search matches them.
                      value={`${option.label} ${option.group ?? ''} ${option.value}`}
                      keywords={option.keywords}
                      disabled={option.disabled}
                      data-checked={isSelected || undefined}
                      onSelect={() => {
                        onChange?.(
                          clearable && isSelected ? undefined : option.value,
                        );
                        setOpen(false);
                      }}
                    >
                      {Icon ? <Icon aria-hidden /> : null}
                      <span className="flex-1 truncate">{option.label}</span>
                      <CheckIcon
                        aria-hidden
                        className={cn(
                          'size-4 text-on-background',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </Popover>
  );

  if (!label && !error) return trigger;

  return (
    <div className="flex flex-col gap-1">
      {label ? <Label htmlFor={triggerId}>{label}</Label> : null}
      {trigger}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-expense">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Combobox, type ComboboxOption, type ComboboxProps };
