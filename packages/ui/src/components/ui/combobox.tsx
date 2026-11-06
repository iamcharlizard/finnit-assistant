'use client';

import * as React from 'react';
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  type LucideIcon,
} from 'lucide-react';

import { rankOptions } from '../../lib/option-search';
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
  /**
   * Lets the user add what they typed when no option has that label. Called
   * with the trimmed text; select the new option (e.g. after saving it) by
   * updating `options` and `value`.
   */
  onCreate?: (text: string) => void | Promise<void>;
  /** Text of the "add" option. */
  createLabel?: (text: string) => string;
  disabled?: boolean;
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
}

/** cmdk value of the "add what I typed" item (never an option's value). */
const CREATE_VALUE = '\u0000create';

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
  onCreate,
  createLabel = (text) => `Add "${text}"`,
  disabled,
  label,
  error,
  id,
  name,
  'aria-label': ariaLabel,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const typed = query.trim().replace(/\s+/g, ' ');
  const canCreate =
    Boolean(onCreate) &&
    typed.length > 0 &&
    !options.some(
      (option) => option.label.toLowerCase() === typed.toLowerCase(),
    );

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setQuery('');
  }

  async function create() {
    if (!onCreate || creating) return;
    setCreating(true);
    try {
      await onCreate(typed);
      changeOpen(false);
    } finally {
      setCreating(false);
    }
  }
  const generatedId = React.useId();
  const triggerId = id ?? generatedId;
  const errorId = `${triggerId}-error`;

  const selected = options.find((option) => option.value === value);
  // Typing: one list, best match first (rankOptions), each with its group
  // as a hint; otherwise the options grouped as given.
  const searching = typed.length > 0;
  const groups = React.useMemo(
    () =>
      searching
        ? [{ heading: undefined, options: rankOptions(options, typed) }]
        : groupOptions(options),
    [options, typed, searching],
  );
  const first = groups[0]?.options.find((option) => !option.disabled);
  // The highlighted item: the best match while typing.
  const [active, setActive] = React.useState('');
  React.useEffect(() => {
    setActive(first?.value ?? (canCreate ? CREATE_VALUE : ''));
  }, [first?.value, canCreate]);
  const SelectedIcon = selected?.icon;

  const trigger = (
    // Modal so it takes over the scroll lock: inside a Dialog, the dialog's
    // lock would otherwise swallow the wheel on the (portaled) list.
    <Popover open={open} onOpenChange={changeOpen} modal>
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
        <Command shouldFilter={false} value={active} onValueChange={setActive}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {canCreate ? null : <CommandEmpty>{emptyText}</CommandEmpty>}
            {groups.map((group) => (
              <CommandGroup key={group.heading ?? ''} heading={group.heading}>
                {group.options.map((option) => {
                  const Icon = option.icon;
                  const isSelected = option.value === value;
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      data-checked={isSelected || undefined}
                      onSelect={() => {
                        onChange?.(
                          clearable && isSelected ? undefined : option.value,
                        );
                        changeOpen(false);
                      }}
                    >
                      {Icon ? <Icon aria-hidden /> : null}
                      <span className="flex-1 truncate">{option.label}</span>
                      {searching &&
                      option.group &&
                      option.group !== option.label ? (
                        <span className="max-w-[45%] shrink-0 truncate text-xs text-on-surface-variant">
                          {option.group}
                        </span>
                      ) : null}
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
            {canCreate ? (
              <CommandGroup>
                <CommandItem
                  value={CREATE_VALUE}
                  disabled={creating}
                  onSelect={() => void create()}
                >
                  <PlusIcon aria-hidden />
                  <span className="flex-1 truncate">{createLabel(typed)}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
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
