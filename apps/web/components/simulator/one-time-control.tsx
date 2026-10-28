'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Plus, ShoppingBag } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Input } from '@finnit/ui/components/ui/input';

import { SelectField } from '@/components/recurring/select-field';
import {
  ITEM_NAME_MAX,
  emptyOneTimeDraft,
  toOneTimeItem,
  validateOneTimeDraft,
  type DraftErrors,
  type OneTimeDraft,
} from '@/lib/simulator/form';
import type { OneTimeItem } from '@/lib/simulator/scenario';
import { ControlSection } from './control-section';
import { ItemRow } from './item-row';

/** One-time expenses in a given month (a trip, a repair, a down payment). */
export function OneTimeControl({
  items,
  months,
  monthLabel,
  formatAmount,
  onAdd,
  onRemove,
}: {
  items: OneTimeItem[];
  months: number;
  /** "Noviembre 2026" for month 1 … months. */
  monthLabel: (month: number) => string;
  formatAmount: (amount: number) => string;
  onAdd: (item: OneTimeItem) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations('simulator.oneTime');
  const tv = useTranslations('simulator.validation');
  const [draft, setDraft] = React.useState<OneTimeDraft>(emptyOneTimeDraft);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const idBase = React.useId();
  const month = Math.min(Number(draft.month) || 1, months);

  function update(patch: Partial<OneTimeDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const current = { ...draft, month: String(month) };
    const found = validateOneTimeDraft(current, months);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onAdd(toOneTimeItem(current, `${idBase}-${Date.now()}`));
    setDraft(emptyOneTimeDraft());
  }

  const options = Array.from({ length: months }, (_, i) => ({
    value: String(i + 1),
    label: monthLabel(i + 1),
  }));

  return (
    <ControlSection
      icon={ShoppingBag}
      title={t('title')}
      description={t('description')}
    >
      <form
        onSubmit={add}
        noValidate
        className="flex flex-col gap-3"
        aria-label={t('title')}
      >
        <Input
          label={t('name')}
          placeholder={t('namePlaceholder')}
          maxLength={ITEM_NAME_MAX}
          autoComplete="off"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          error={errors.name ? tv(errors.name) : undefined}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('amount')}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={draft.amount}
            onChange={(e) => update({ amount: e.target.value })}
            error={errors.amount ? tv(errors.amount) : undefined}
          />
          <SelectField
            label={t('month')}
            value={String(month)}
            options={options}
            onChange={(value) => update({ month: value })}
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="self-end">
          <Plus aria-hidden /> {t('submit')}
        </Button>
      </form>
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const title = item.name || t('defaultName');
            const outside = item.month > months;
            return (
              <ItemRow
                key={item.id}
                title={title}
                detail={outside ? t('outOfRange') : monthLabel(item.month)}
                amount={`-${formatAmount(item.amount)}`}
                muted={outside}
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
