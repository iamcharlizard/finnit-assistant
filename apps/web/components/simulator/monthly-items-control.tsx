'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Repeat } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Input } from '@finnit/ui/components/ui/input';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';

import {
  ITEM_NAME_MAX,
  emptyMonthlyDraft,
  toMonthlyItem,
  validateMonthlyDraft,
  type DraftErrors,
  type MonthlyDraft,
} from '@/lib/simulator/form';
import type { MonthlyItem, MonthlyItemKind } from '@/lib/simulator/scenario';
import { ControlSection } from './control-section';
import { ItemRow } from './item-row';

/** Monthly expenses the scenario adds ("nuevo auto") or cuts ("cancelar gym"). */
export function MonthlyItemsControl({
  items,
  formatAmount,
  onAdd,
  onRemove,
}: {
  items: MonthlyItem[];
  formatAmount: (amount: number) => string;
  onAdd: (item: MonthlyItem) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('simulator.monthly');
  const tv = useTranslations('simulator.validation');
  const [draft, setDraft] = React.useState<MonthlyDraft>(emptyMonthlyDraft);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const nameId = React.useId();

  function update(patch: Partial<MonthlyDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const found = validateMonthlyDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onAdd(toMonthlyItem(draft, `${nameId}-${Date.now()}`));
    setDraft((current) => ({ ...emptyMonthlyDraft(), kind: current.kind }));
  }

  return (
    <ControlSection
      icon={Repeat}
      title={t('title')}
      description={t('description')}
    >
      <form
        onSubmit={add}
        noValidate
        className="flex flex-col gap-3"
        aria-label={t('title')}
      >
        <ToggleGroup
          type="single"
          value={draft.kind}
          onValueChange={(value) =>
            value && update({ kind: value as MonthlyItemKind })
          }
          aria-label={t('kind')}
          className="flex-wrap"
        >
          <ToggleGroupItem value="add" className="min-h-9 px-4 py-1.5 text-xs">
            {t('add')}
          </ToggleGroupItem>
          <ToggleGroupItem value="cut" className="min-h-9 px-4 py-1.5 text-xs">
            {t('cut')}
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Input
            label={t('name')}
            placeholder={
              draft.kind === 'add'
                ? t('namePlaceholderAdd')
                : t('namePlaceholderCut')
            }
            maxLength={ITEM_NAME_MAX}
            autoComplete="off"
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            error={errors.name ? tv(errors.name) : undefined}
          />
          <Input
            label={t('amount')}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => update({ amount: e.target.value })}
            error={errors.amount ? tv(errors.amount) : undefined}
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="self-end">
          <Plus aria-hidden />{' '}
          {draft.kind === 'add' ? t('submitAdd') : t('submitCut')}
        </Button>
      </form>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const title =
              item.name ||
              (item.kind === 'add' ? t('defaultAdd') : t('defaultCut'));
            return (
              <ItemRow
                key={item.id}
                title={title}
                detail={
                  item.kind === 'add' ? t('perMonthAdd') : t('perMonthCut')
                }
                amount={`${item.kind === 'add' ? '+' : '-'}${formatAmount(item.amount)}`}
                removeLabel={t('remove', { name: title })}
                onRemove={() => onRemove(item.id)}
              />
            );
          })}
        </ul>
      ) : null}
    </ControlSection>
  );
}
