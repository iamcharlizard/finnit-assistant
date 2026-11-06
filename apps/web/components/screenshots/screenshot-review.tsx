'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CircleAlert, Pencil } from 'lucide-react';

import { Badge } from '@finnit/ui/components/ui/badge';
import { Button } from '@finnit/ui/components/ui/button';
import { Checkbox } from '@finnit/ui/components/ui/checkbox';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { DatePicker } from '@finnit/ui/components/ui/date-picker';
import { Input } from '@finnit/ui/components/ui/input';
import { MoneyInput } from '@finnit/ui/components/ui/money-input';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@finnit/ui/components/ui/toggle-group';
import { cn } from '@finnit/ui/lib/utils';

import { SwitchField } from '@/components/finance/switch-field';
import { todayKey } from '@finnit/core/finance/dates';
import type { EntryAccount, EntryCategory } from '@finnit/core/new-entry/graphql';
import { accountOptions, categoryOptions } from '@finnit/core/new-entry/options';
import { useLocalizer } from '@/lib/i18n/client';
import type {
  ScreenshotImport,
  ScreenshotLine,
  ScreenshotLineChange,
} from '@finnit/core/screenshots/graphql';
import {
  buildScreenshotReview,
  lineChangeOf,
  lineDraftOf,
  validateLineDraft,
  type LineDraft,
  type ScreenshotRow,
} from '@finnit/core/screenshots/view';

/** Fields read poorly: the same amber as the expense form's checks. */
const CHECK_CLASS =
  'border-amber-500 ring-[3px] ring-amber-500/25 dark:border-amber-400';

/**
 * The movements read from a screenshot: the account they belong to, each
 * line with what to check, the ones already registered (left out unless the
 * user says otherwise), and saving them all at once.
 */
export function ScreenshotReview({
  shot,
  accounts,
  categories,
  busy,
  error,
  onAccount,
  onLine,
  onSave,
  onDiscard,
}: {
  shot: ScreenshotImport;
  accounts: EntryAccount[];
  categories: EntryCategory[];
  /** Something is being saved: the controls wait. */
  busy: boolean;
  error: string | null;
  onAccount: (accountId: string) => void;
  /** Resolves when saved (true) or failed (false). */
  onLine: (lineId: string, change: ScreenshotLineChange) => Promise<boolean>;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations('screenshots.review');
  const tf = useTranslations('newEntry.fields');
  const l = useLocalizer();
  const review = buildScreenshotReview(shot, l);
  const [editing, setEditing] = React.useState<string | null>(null);
  const accountItems = React.useMemo(
    () => accountOptions(accounts),
    [accounts],
  );
  const lineById = new Map(shot.lines.map((line) => [line.id, line]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Combobox
          label={t('account')}
          options={accountItems}
          value={shot.account?.id}
          onChange={(accountId) => accountId && onAccount(accountId)}
          placeholder={t('accountPlaceholder')}
          searchPlaceholder={tf('accountSearch')}
          emptyText={tf('accountEmpty')}
          disabled={busy}
          className={shot.account ? undefined : CHECK_CLASS}
        />
        <p className="px-1 text-xs text-on-surface-variant">
          {shot.account
            ? shot.accountHint
              ? t('detected', { hint: shot.accountHint })
              : null
            : shot.accountHint
              ? t('noAccount', { hint: shot.accountHint })
              : t('noHint')}
        </p>
      </div>

      <p className="px-1 text-sm text-on-surface-variant">
        {t('read', { count: shot.movementsRead })}
        {review.toCheck > 0
          ? ` · ${t('toCheck', { count: review.toCheck })}`
          : null}
      </p>

      {shot.account ? (
        <ul className="flex flex-col gap-2">
          {review.rows.map((row) => {
            const line = lineById.get(row.id)!;
            return (
              <li key={row.id}>
                {editing === row.id ? (
                  <LineEditor
                    line={line}
                    row={row}
                    currency={shot.account?.currency ?? 'MXN'}
                    categories={categories}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={async (change) => {
                      if (await onLine(line.id, change)) setEditing(null);
                    }}
                  />
                ) : (
                  <LineRow
                    row={row}
                    busy={busy}
                    onToggle={(include) => void onLine(line.id, { include })}
                    onEdit={() => setEditing(row.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] text-expense">
          {error}
        </p>
      ) : null}
      {review.blocked ? (
        <p className="flex items-start gap-2 text-sm text-on-surface-variant">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('blocked')}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {shot.account && review.toSave > 0 ? (
          <p className="px-1 text-sm font-semibold text-on-background tabular-nums">
            {t('total', { amount: review.total })}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={
            busy ||
            !shot.account ||
            review.blocked ||
            editing !== null ||
            review.toSave === 0
          }
          onClick={onSave}
        >
          {t('save', { count: review.toSave })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onDiscard}
        >
          {t('discard')}
        </Button>
      </div>
    </div>
  );
}

function LineRow({
  row,
  busy,
  onToggle,
  onEdit,
}: {
  row: ScreenshotRow;
  busy: boolean;
  onToggle: (include: boolean) => void;
  onEdit: () => void;
}) {
  const t = useTranslations('screenshots.review');
  const name = row.merchant || t('noName');
  const id = `shot-line-${row.id}`;
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-outline p-3',
        row.included && row.needsCheck && CHECK_CLASS,
        !row.included && 'opacity-70',
      )}
    >
      <Checkbox
        id={id}
        checked={row.included}
        disabled={busy}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={t('include', { merchant: name })}
        className="mt-1"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <label
            htmlFor={id}
            className="min-w-0 truncate text-sm font-medium text-on-background"
          >
            {name}
          </label>
          <span
            className={cn(
              'shrink-0 text-sm font-semibold tabular-nums',
              row.direction === 'in' ? 'text-income' : 'text-on-background',
            )}
          >
            {row.amount}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant">
          <span>{row.date}</span>
          {row.inProcess ? (
            <Badge variant="highlight">{t('inProcess')}</Badge>
          ) : null}
          {row.included && row.needsCheck ? (
            <Badge variant="outline">{t('check')}</Badge>
          ) : null}
        </div>
        {row.registered ? (
          <p className="text-xs text-on-surface-variant">
            {t('registered', {
              name: row.registered.name || t('noName'),
              date: row.registered.date,
            })}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={busy}
        onClick={onEdit}
        aria-label={t('edit', { merchant: name })}
      >
        <Pencil aria-hidden />
      </Button>
    </div>
  );
}

function LineEditor({
  line,
  row,
  currency,
  categories,
  busy,
  onCancel,
  onSave,
}: {
  line: ScreenshotLine;
  row: ScreenshotRow;
  currency: string;
  categories: EntryCategory[];
  busy: boolean;
  onCancel: () => void;
  onSave: (change: ScreenshotLineChange) => void;
}) {
  const t = useTranslations('screenshots.review');
  const tf = useTranslations('newEntry.fields');
  const locale = useLocale();
  const today = todayKey();
  const [draft, setDraft] = React.useState<LineDraft>(() => lineDraftOf(line));
  const [tried, setTried] = React.useState(false);
  const errors = tried ? validateLineDraft(draft, today) : {};
  const set = (patch: Partial<LineDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const categoryItems = React.useMemo(
    () =>
      categoryOptions(
        categories,
        draft.direction === 'in' ? 'income' : 'expense',
        locale,
      ),
    [categories, draft.direction, locale],
  );

  function save() {
    setTried(true);
    if (Object.keys(validateLineDraft(draft, today)).length > 0) return;
    const change = lineChangeOf(line, draft);
    if (change) onSave(change as ScreenshotLineChange);
    else onCancel();
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand p-3">
      <Input
        label={t('merchant')}
        value={draft.merchant}
        maxLength={120}
        autoComplete="off"
        onChange={(e) => set({ merchant: e.target.value })}
        error={errors.merchant && t(`errors.${errors.merchant}`)}
        className={row.checkMerchant ? CHECK_CLASS : undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <MoneyInput
          label={t('amount')}
          value={draft.amount}
          currency={currency}
          onValueChange={(amount) => set({ amount })}
          error={errors.amount && t(`errors.${errors.amount}`)}
          className={row.checkAmount ? CHECK_CLASS : undefined}
        />
        <DatePicker
          label={t('date')}
          value={draft.date}
          max={today}
          locale={locale}
          onChange={(date) => date && set({ date })}
          error={errors.date && t(`errors.${errors.date}`)}
          className={row.checkDate ? CHECK_CLASS : undefined}
        />
      </div>
      <ToggleGroup
        type="single"
        value={draft.direction}
        onValueChange={(value) =>
          value && set({ direction: value as LineDraft['direction'] })
        }
        className="flex-wrap"
      >
        <ToggleGroupItem value="out">{t('directionOut')}</ToggleGroupItem>
        <ToggleGroupItem value="in">{t('directionIn')}</ToggleGroupItem>
      </ToggleGroup>
      <Combobox
        label={t('category')}
        options={categoryItems}
        value={draft.categoryId || undefined}
        onChange={(categoryId) => set({ categoryId: categoryId ?? '' })}
        placeholder={t('categoryPlaceholder')}
        searchPlaceholder={tf('categorySearch')}
        emptyText={tf('categoryEmpty')}
        clearable
      />
      <SwitchField
        label={t('inProcessLabel')}
        hint={t('inProcessHint')}
        checked={draft.inProcess}
        onCheckedChange={(inProcess) => set({ inProcess })}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancelEdit')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={save}
        >
          {t('done')}
        </Button>
      </div>
    </div>
  );
}
