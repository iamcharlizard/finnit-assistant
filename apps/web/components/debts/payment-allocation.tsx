'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';
import { cn } from '@finnit/ui/lib/utils';

import type {
  AllocationPreview,
  PaymentSurplus,
  PendingPayment,
} from '@finnit/core/debts/allocation';

/**
 * Purchase financing and personal loans: which pending payments a payment
 * covers (none = a payment to the balance, abono), and what happens with
 * the difference — what falls short leaves a payment paid in part, what is
 * left over goes to the next ones or to the balance, as the user picks.
 */
export function PaymentAllocation({
  pending,
  chosen,
  onChosenChange,
  surplus,
  onSurplusChange,
  preview,
  money,
}: {
  pending: PendingPayment[];
  chosen: string[];
  onChosenChange: (ids: string[]) => void;
  surplus: PaymentSurplus;
  onSurplusChange: (surplus: PaymentSurplus) => void;
  preview: AllocationPreview | null;
  money: (n: number) => string;
}) {
  const tf = useTranslations('debts.payment.allocation');
  const toggle = (id: string, on: boolean) =>
    onChosenChange(
      on ? [...chosen, id] : chosen.filter((other) => other !== id),
    );
  const chosenTotal = pending
    .filter((p) => chosen.includes(p.occurrenceId))
    .reduce((sum, p) => sum + p.due, 0);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="px-1 text-sm font-medium">{tf('title')}</legend>
      <p className="px-1 text-xs text-on-surface-variant">{tf('hint')}</p>
      <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-input border border-input p-1">
        {pending.map((p) => {
          const id = `pay-${p.occurrenceId}`;
          const on = chosen.includes(p.occurrenceId);
          return (
            <li key={p.occurrenceId}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-accent',
                  on && 'bg-accent/60',
                )}
              >
                <Checkbox
                  id={id}
                  checked={on}
                  onCheckedChange={(value) =>
                    toggle(p.occurrenceId, value === true)
                  }
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">{p.dateLabel}</span>
                  {p.concepts.length > 0 ? (
                    <span className="truncate text-xs text-on-surface-variant">
                      {p.concepts.join(' · ')}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  {tf('due', { amount: money(p.due) })}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {chosen.length === 0 ? (
        <Note icon={Info}>{tf('abonoNote')}</Note>
      ) : (
        <p className="px-1 text-xs text-on-surface-variant">
          {tf('chosen', { amount: money(chosenTotal) })}
        </p>
      )}

      {preview && chosen.length > 0 ? (
        preview.shortfall > 0 ? (
          <Note icon={AlertTriangle} tone="warning">
            {tf('shortfall', {
              amount: money(preview.shortfall),
              date: preview.partial?.dateLabel ?? '',
            })}
          </Note>
        ) : preview.surplus > 0 ? (
          <div className="flex flex-col gap-2">
            <Note icon={AlertTriangle} tone="warning">
              {tf('surplus', { amount: money(preview.surplus) })}
            </Note>
            <ToggleGroup
              type="single"
              value={surplus}
              onValueChange={(value) =>
                value && onSurplusChange(value as PaymentSurplus)
              }
              aria-label={tf('surplus', { amount: money(preview.surplus) })}
              className="flex-wrap"
            >
              <ToggleGroupItem value="next">
                {tf('surplusNext')}
              </ToggleGroupItem>
              <ToggleGroupItem value="balance">
                {tf('surplusBalance')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : (
          <Note icon={CheckCircle2}>{tf('exact')}</Note>
        )
      ) : null}
    </fieldset>
  );
}

function Note({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Info;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === 'warning' ? 'status' : undefined}
      className={cn(
        'flex items-start gap-2 rounded-input p-3 text-xs',
        tone === 'warning'
          ? 'bg-[rgba(245,158,11,0.1)] text-on-background'
          : 'bg-track/60 text-on-background',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </p>
  );
}
